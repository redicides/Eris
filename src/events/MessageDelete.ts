import {
  type PartialMessage,
  type Message as DiscordMessage,
  Events,
  EmbedBuilder,
  WebhookClient,
  APIMessage
} from 'discord.js';

import { GuildConfig } from '@utils/Types';
import { ReportUtils } from '@utils/Reports';
import { extractChannelIds, getMessageLogEmbed } from '@utils/index';

import DatabaseManager from '@managers/database/DatabaseManager';
import EventListener from '@managers/events/EventListener';

export default class MessageDelete extends EventListener {
  constructor() {
    super(Events.MessageDelete);
  }

  async execute(deletedMessage: DiscordMessage | PartialMessage) {
    if (!deletedMessage.inGuild()) return;
    if (deletedMessage.partial) await deletedMessage.fetch().catch(() => null);

    const config = await DatabaseManager.getGuildEntry(deletedMessage.guild.id);
    const channelIds = extractChannelIds(deletedMessage.channel);

    await ReportUtils.updateMessageReportState({
      guild: deletedMessage.guild,
      messageId: deletedMessage.id,
      config
    });

    await ReportUtils.updateMessageReportReferenceState({
      guild: deletedMessage.guild,
      referenceId: deletedMessage.id,
      config
    });

    if (!config.messageLoggingEnabled || !config.messageLoggingWebhook) {
      return;
    }

    if (channelIds.some(id => config.messageLoggingIgnoredChannels.includes(id))) {
      return;
    }

    return MessageDelete.handleLog(deletedMessage, config);
  }

  public static async handleLog(deletedMessage: DiscordMessage<true>, config: GuildConfig) {
    const message = await DatabaseManager.deleteMessageEntry(deletedMessage.id);

    if (!message) {
      return MessageDelete._attemptDiscordLog(deletedMessage, config);
    }

    const { messageLoggingWebhook } = config;

    const reference = message.referenceId && (await DatabaseManager.getMessageEntry(message.referenceId));
    let embeds: EmbedBuilder[] = [];

    const embed = await getMessageLogEmbed(
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
      const embed = await getMessageLogEmbed(
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

    return new WebhookClient({ url: messageLoggingWebhook! }).send({ embeds }).catch(() => null);
  }

  public static async _attemptDiscordLog(
    message: DiscordMessage<true>,
    config: GuildConfig
  ): Promise<APIMessage | null> {
    if (!message.author || message.author.bot || message.webhookId !== null) {
      return null;
    }

    const { messageLoggingWebhook } = config;

    const stickerId = message.stickers?.first()?.id ?? null;
    const reference = message.reference && (await message.fetchReference().catch(() => null));

    let embeds: EmbedBuilder[] = [];

    const embed = await getMessageLogEmbed(
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

      const embed = await getMessageLogEmbed(
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
    return new WebhookClient({ url: messageLoggingWebhook! }).send({ embeds }).catch(() => null);
  }
}
