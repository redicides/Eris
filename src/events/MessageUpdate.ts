import {
  Events,
  Message as DiscordMessage,
  PartialMessage,
  EmbedBuilder,
  Colors,
  Snowflake,
  WebhookClient
} from 'discord.js';

import { Message } from '@prisma/client';

import { channelMentionWithId, cleanContent, formatMessageContentForShortLog, userMentionWithId } from '@utils/index';
import { GuildConfig } from '@utils/Types';
import { EMPTY_MESSAGE_CONTENT } from '@utils/Constants';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';
import MessageDelete from './MessageDelete';

export default class MessageUpdate extends EventListener {
  constructor() {
    super(Events.MessageUpdate);
  }

  async execute(_oldMessage: DiscordMessage, _newMessage: PartialMessage | DiscordMessage) {
    if (!_newMessage.inGuild()) return;

    const message = _newMessage.partial
      ? ((await _newMessage.fetch().catch(() => null)) as DiscordMessage<true> | null)
      : _newMessage;

    // Early return if there is no sufficient data
    if (!message || message.author.bot || message.webhookId !== null || !message.content) return;

    const config = await DatabaseManager.getGuildEntry(message.guild.id);
    const channelId = message.channel.id || message.channel.parent?.id || message.channel.parent?.parentId;

    if (channelId && config.messageLoggingIgnoredChannels.includes(channelId)) return;

    const newContent = cleanContent(message.content, message.channel);
    const oldContent = await DatabaseManager.updateMessageEntry(message.id, newContent);

    if (config.messageLoggingStoreMessages) {
      const dbMessage = await DatabaseManager.getMessageEntry(message.id);

      if (dbMessage) {
        return MessageUpdate.handleEnhancedLog(dbMessage, message, oldContent, newContent, config);
      } else {
        return MessageUpdate.handleNormalLog(message, config);
      }
    } else {
      return MessageUpdate.handleNormalLog(message, config);
    }
  }

  public static async handleEnhancedLog(
    dbMessage: Message,
    discordMessage: DiscordMessage<true>,
    oldContent: string,
    newContent: string,
    config: GuildConfig
  ) {
    if (!config.messageLoggingEnabled || !config.messageLoggingWebhook) return;

    const embeds: EmbedBuilder[] = [];

    if (dbMessage.referenceId || discordMessage.reference?.messageId) {
      const referenceMessage = await MessageUpdate._fetchReferenceMessage(dbMessage, discordMessage);

      if (referenceMessage) {
        const embed = await MessageDelete.buildLogEmbed(referenceMessage, true);
        embeds.push(embed);
      }
    }

    const embed = await MessageUpdate._buildLogEmbed({
      authorId: dbMessage.authorId,
      channelId: dbMessage.channelId,
      oldContent,
      newContent,
      messageUrl: discordMessage.url,
      attachments: dbMessage.attachments
    });

    embeds.push(embed);

    return new WebhookClient({ url: config.messageLoggingWebhook }).send({ embeds }).catch(() => null);
  }

  public static async handleNormalLog(message: DiscordMessage<true>, config: GuildConfig) {
    if (!config.messageLoggingEnabled || !config.messageLoggingWebhook) return;

    const embeds: EmbedBuilder[] = [];
    const reference = message.reference && (await message.fetchReference().catch(() => null));

    if (reference) {
      const stickerId = reference.stickers?.first()?.id ?? null;

      const embed = await MessageDelete.buildLogEmbed(
        {
          guildId: reference.guildId,
          messageId: reference.id,
          authorId: reference.author.id,
          channelId: reference.channel.id,
          stickerId,
          createdAt: reference.createdAt,
          content: reference.content,
          attachments: Array.from(reference.attachments.values()).map(attachment => attachment.url)
        },
        true
      );

      embeds.push(embed);
    }

    const embed = await MessageUpdate._buildLogEmbed({
      authorId: message.author.id,
      channelId: message.channel.id,
      oldContent: message.content ?? EMPTY_MESSAGE_CONTENT,
      newContent: message.content,
      messageUrl: message.url,
      attachments: Array.from(message.attachments.values()).map(attachment => attachment.url)
    });

    embeds.push(embed);

    return new WebhookClient({ url: config.messageLoggingWebhook }).send({ embeds: [embed] }).catch(() => null);
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
    const formattedNewContent = await formatMessageContentForShortLog(data.newContent, null, data.messageUrl);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setAuthor({ name: 'Message Updated' })
      .setFields([
        {
          name: 'Author',
          value: userMentionWithId(data.authorId)
        },
        {
          name: 'Source Channel',
          value: channelMentionWithId(data.channelId)
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

  private static async _fetchReferenceMessage(dbMessage: Message, discordMessage: DiscordMessage<true>) {
    const referenceMessage: Message | DiscordMessage | null =
      (await DatabaseManager.getMessageEntry(dbMessage.referenceId!)) ??
      (await discordMessage.fetchReference().catch(() => null));

    if (!referenceMessage) return null;

    return {
      guildId: discordMessage.guildId,
      messageId: referenceMessage.id,
      authorId:
        (referenceMessage instanceof DiscordMessage ? referenceMessage.author.id : referenceMessage.authorId) ?? null,
      channelId: referenceMessage.channelId,
      stickerId:
        'stickerId' in referenceMessage ? referenceMessage.stickerId : referenceMessage.stickers?.first()?.id ?? null,
      createdAt:
        referenceMessage instanceof DiscordMessage
          ? referenceMessage.createdAt
          : new Date(Number(referenceMessage.createdAt)),
      content: referenceMessage.content,
      attachments:
        referenceMessage instanceof DiscordMessage
          ? Array.from(referenceMessage.attachments.values()).map(attachment => attachment.url)
          : referenceMessage.attachments
    };
  }
}
