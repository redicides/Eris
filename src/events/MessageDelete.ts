import {
  type PartialMessage,
  type Message as DiscordMessage,
  Events,
  EmbedBuilder,
  Colors,
  messageLink,
  WebhookClient,
  APIMessage,
  Snowflake,
  Guild,
  TextChannel
} from 'discord.js';

import { GuildConfig } from '@utils/Types';
import { channelMentionWithId, formatMessageContentForShortLog, userMentionWithId } from '@utils/index';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';
import { prisma } from '..';

export default class MessageDelete extends EventListener {
  constructor() {
    super(Events.MessageDelete);
  }

  async execute(deletedMessage: DiscordMessage | PartialMessage) {
    if (!deletedMessage.inGuild()) return;
    if (deletedMessage.partial) await deletedMessage.fetch().catch(() => null);

    const config = await DatabaseManager.getGuildEntry(deletedMessage.guild.id);
    await updateMessageReportState({
      deletedMessage,
      config
    });

    if (config.messageLoggingStoreMessages) {
      return MessageDelete.handleEnhancedLog(deletedMessage, config);
    }

    return MessageDelete.handleNormalLog(deletedMessage, config);
  }

  public static async handleNormalLog(message: DiscordMessage<true>, config: GuildConfig): Promise<APIMessage | null> {
    if (!message.author || message.author.bot || message.webhookId) {
      return null;
    }

    const { messageLoggingEnabled, messageLoggingWebhook, messageLoggingIgnoredChannels } = config;
    const channelId = message.channel.id ?? message.channel.parent?.id ?? message.channel.parent?.parentId;

    if (!messageLoggingEnabled || !messageLoggingWebhook || messageLoggingIgnoredChannels.includes(channelId)) {
      return null;
    }

    const stickerId = message.stickers?.first()?.id ?? null;
    const reference = message.reference && (await message.fetchReference().catch(() => null));

    let embeds: EmbedBuilder[] = [];

    const embed = await MessageDelete.buildLogEmbed(
      {
        guildId: message.guildId,
        messageId: message.id,
        authorId: message.author.id,
        channelId: message.channel.id,
        stickerId,
        createdAt: message.createdAt,
        content: message.content,
        attachments: Array.from(message.attachments.values()).map(attachment => attachment.url)
      },
      false
    );

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

    embeds.push(embed);
    return new WebhookClient({ url: messageLoggingWebhook }).send({ embeds }).catch(() => null);
  }

  public static async handleEnhancedLog(deletedMessage: DiscordMessage<true>, config: GuildConfig) {
    const message = await DatabaseManager.deleteMessageEntry(deletedMessage.id);

    if (!message) {
      return MessageDelete.handleNormalLog(deletedMessage, config);
    }

    const { messageLoggingEnabled, messageLoggingWebhook, messageLoggingIgnoredChannels } = config;
    const channelId = message.channelId ?? message.channelParentId ?? message.channelParentParentId;

    if (!messageLoggingEnabled || !messageLoggingWebhook || messageLoggingIgnoredChannels.includes(channelId)) {
      return null;
    }

    const reference = message.referenceId && (await DatabaseManager.getMessageEntry(message.referenceId));
    let embeds: EmbedBuilder[] = [];

    const embed = await MessageDelete.buildLogEmbed(
      {
        guildId: message.guildId,
        messageId: message.id,
        authorId: message.authorId,
        channelId: message.channelId,
        stickerId: message.stickerId,
        createdAt: new Date(Number(message.createdAt)),
        content: message.content,
        attachments: message.attachments
      },
      false
    );

    if (reference) {
      const embed = await MessageDelete.buildLogEmbed(
        {
          guildId: reference.guildId,
          messageId: reference.id,
          authorId: reference.authorId,
          channelId: reference.channelId,
          stickerId: reference.stickerId,
          createdAt: new Date(Number(reference.createdAt)),
          content: reference.content,
          attachments: reference.attachments
        },
        true
      );

      embeds.push(embed);
    }

    embeds.push(embed);

    return new WebhookClient({ url: messageLoggingWebhook }).send({ embeds }).catch(() => null);
  }

  private static async buildLogEmbed(
    data: {
      guildId: Snowflake;
      messageId: Snowflake;
      authorId: Snowflake;
      channelId: Snowflake;
      stickerId: Snowflake | null;
      createdAt: Date;
      content: string | null;
      attachments?: string[];
    },
    reference: boolean
  ): Promise<EmbedBuilder> {
    const url = messageLink(data.channelId, data.messageId, data.guildId);

    const embed = new EmbedBuilder()
      .setColor(reference ? Colors.NotQuiteBlack : Colors.Red)
      .setAuthor({ name: reference ? 'Message Reference' : 'Message Deleted' })
      .setFields([
        {
          name: 'Author',
          value: userMentionWithId(data.authorId)
        },
        {
          name: 'Channel',
          value: channelMentionWithId(data.channelId)
        },
        {
          name: 'Content',
          value: await formatMessageContentForShortLog(data.content, data.stickerId, url)
        }
      ])
      .setTimestamp(data.createdAt);

    if (data.attachments?.length) {
      embed.addFields({
        name: 'Attachments',
        value: data.attachments.map(attachment => `[Attachment](${attachment})`).join(', ')
      });
    }

    return embed;
  }
}

async function updateMessageReportState(data: { deletedMessage: DiscordMessage<true>; config: GuildConfig }) {
  const { deletedMessage, config } = data;

  if (!config.messageReportsEnabled || !config.messageReportsWebhook) return;

  const reports = await prisma.messageReport.findMany({
    where: { messageId: deletedMessage.id, guildId: config.id, status: 'Pending' }
  });

  if (!reports.length) return;

  for (const report of reports) {
    const webhook = new WebhookClient({ url: config.messageReportsWebhook });
    const log = await webhook.fetchMessage(report.id).catch(() => null);

    if (!log) continue;

    const primaryEmbed = log.embeds.at(log.components!.length === 1 ? 0 : 1)!;
    const secondaryEmbed = log.components!.length === 1 ? null : log.embeds.at(0)!;

    const updatedEmbed = new EmbedBuilder(primaryEmbed).addFields({ name: 'Flags', value: 'Message Deleted' });

    const components = log.components!;
    const baseEditOptions = {
      content: log.content
    };

    if (secondaryEmbed) {
      components[1].components[0].disabled = true;

      await webhook
        .editMessage(log.id, {
          ...baseEditOptions,
          embeds: [secondaryEmbed, updatedEmbed],
          components
        })
        .catch(() => null);
    } else {
      components[0].components[3].disabled = true;

      await webhook
        .editMessage(log.id, {
          ...baseEditOptions,
          embeds: [updatedEmbed],
          components
        })
        .catch(() => null);
    }
  }
}
