import {
  Events,
  Message as DiscordMessage,
  PartialMessage,
  EmbedBuilder,
  Colors,
  Snowflake,
  WebhookClient,
  channelMention
} from 'discord.js';

import { Message } from '@prisma/client';

import {
  cleanContent,
  extractChannelIds,
  formatMessageContentForShortLog,
  getMessageLogEmbed,
  getReferenceMessage,
  userMentionWithId
} from '@utils/index';
import { GuildConfig } from '@utils/Types';
import { EmptyMessageContent } from '@utils/Constants';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';

export default class MessageUpdate extends EventListener {
  constructor() {
    super(Events.MessageUpdate);
  }

  async execute(_oldMessage: PartialMessage | DiscordMessage, _newMessage: PartialMessage | DiscordMessage) {
    if (!_newMessage.inGuild()) return;

    const message = _newMessage.partial
      ? ((await _newMessage.fetch().catch(() => null)) as DiscordMessage<true> | null)
      : _newMessage;

    // Early return if there is no sufficient data or if the message is from a bot, webhook, or the system
    if (!message || message.author.bot || message.webhookId !== null || message.system || !message.content) return;

    const config = await DatabaseManager.getGuildEntry(message.guild.id);
    const channelIds = extractChannelIds(message.channel);

    if (channelIds.some(id => config.message_logging_ignored_channels.includes(id))) {
      return;
    }

    const newContent = cleanContent(message.content, message.channel);
    const oldContent = await DatabaseManager.updateMessageEntry(message.id, newContent);

    const dbMessage = await DatabaseManager.getMessageEntry(message.id);

    if (oldContent === newContent || !oldContent) return;

    if (dbMessage) {
      return MessageUpdate.handleLog(dbMessage, message, oldContent, newContent, config);
    } else {
      return MessageUpdate._attemptDiscordLog(message, _oldMessage, config);
    }
  }

  public static async handleLog(
    dbMessage: Message,
    discordMessage: DiscordMessage<true>,
    oldContent: string,
    newContent: string,
    config: GuildConfig
  ) {
    if (!config.message_logging_enabled || !config.message_logging_webhook) return;

    const embeds: EmbedBuilder[] = [];

    if (dbMessage.reference_id || discordMessage.reference?.messageId) {
      const referenceMessage = await getReferenceMessage(dbMessage, discordMessage);

      if (referenceMessage) {
        const embed = await getMessageLogEmbed(referenceMessage, true);
        embeds.push(embed);
      }
    }

    const embed = await MessageUpdate._buildLogEmbed({
      authorId: dbMessage.author_id,
      channelId: dbMessage.channel_id,
      oldContent,
      newContent,
      messageUrl: discordMessage.url,
      attachments: dbMessage.attachments
    });

    embeds.push(embed);

    return new WebhookClient({ url: config.message_logging_webhook }).send({ embeds }).catch(() => null);
  }

  public static async _attemptDiscordLog(
    message: DiscordMessage<true>,
    oldMessage: PartialMessage | DiscordMessage,
    config: GuildConfig
  ) {
    if (!config.message_logging_enabled || !config.message_logging_webhook) return;

    const embeds: EmbedBuilder[] = [];

    if (message.reference?.messageId) {
      const reference = message.reference && (await message.fetchReference().catch(() => null));
      const dbReference = await DatabaseManager.getMessageEntry(message.reference.messageId);

      if (reference) {
        const stickerId = reference.stickers?.first()?.id ?? null;

        const embed = await getMessageLogEmbed(
          {
            guild_id: reference.guildId,
            message_id: reference.id,
            author_id: reference.author.id,
            channel_id: reference.channel.id,
            sticker_id: stickerId,
            created_at: reference.createdAt,
            content: reference.content,
            attachments: Array.from(reference.attachments.values()).map(attachment => attachment.url)
          },
          true
        );

        embeds.push(embed);
      } else if (dbReference) {
        const stickerId = dbReference.sticker_id;

        const embed = await getMessageLogEmbed(
          {
            guild_id: dbReference.guild_id,
            message_id: dbReference.id,
            author_id: dbReference.author_id,
            channel_id: dbReference.channel_id,
            sticker_id: stickerId,
            created_at: dbReference.created_at,
            content: dbReference.content,
            attachments: dbReference.attachments
          },
          true
        );

        embeds.push(embed);
      }
    }

    const embed = await MessageUpdate._buildLogEmbed({
      authorId: message.author.id,
      channelId: message.channel.id,
      oldContent: oldMessage.content ?? EmptyMessageContent,
      newContent: message.content,
      messageUrl: message.url,
      attachments: Array.from(message.attachments.values()).map(attachment => attachment.url)
    });

    embeds.push(embed);

    return new WebhookClient({ url: config.message_logging_webhook }).send({ embeds: [embed] }).catch(() => null);
  }

  private static async _buildLogEmbed(data: {
    authorId: Snowflake;
    channelId: Snowflake;
    oldContent: string;
    newContent: string;
    messageUrl: string;
    attachments?: string[];
  }) {
    const formattedOldContent = await formatMessageContentForShortLog(data.oldContent, null, data.messageUrl);
    const formattedNewContent = await formatMessageContentForShortLog(data.newContent, null, data.messageUrl, false);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setAuthor({ name: 'Message Updated' })
      .setFields([
        {
          name: 'Author',
          value: userMentionWithId(data.authorId)
        },
        {
          name: 'Channel',
          value: channelMention(data.channelId)
        },
        {
          name: 'Content (Before)',
          value: formattedOldContent
        },
        {
          name: 'Content (After)',
          value: formattedNewContent
        }
      ])
      .setTimestamp();

    if (data.attachments?.length) {
      embed.addFields({
        name: 'Attachments',
        value: data.attachments.map(attachment => `[Attachment](${attachment})`).join(', ')
      });
    }

    return embed;
  }
}
