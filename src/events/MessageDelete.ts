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
import { extractChannelIds, getMessageLogEmbed, getReferenceMessage } from '@utils/index';

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

    await ReportUtils.updateMessageReportStates({
      guild: deletedMessage.guild,
      message_id: deletedMessage.id,
      config
    });

    if (!config.message_logging_enabled || !config.message_logging_webhook) {
      return;
    }

    if (channelIds.some(id => config.message_logging_ignored_channels.includes(id))) {
      return;
    }

    return MessageDelete.handleLog(deletedMessage, config);
  }

  public static async handleLog(deletedMessage: DiscordMessage<true>, config: GuildConfig) {
    const message = await DatabaseManager.deleteMessageEntry(deletedMessage.id);

    if (!message) {
      return MessageDelete._attemptDiscordLog(deletedMessage, config);
    }

    const { message_logging_webhook } = config;

    let embeds: EmbedBuilder[] = [];

    if (message.reference_id || deletedMessage.reference?.messageId) {
      const referenceMessage = await getReferenceMessage(message, deletedMessage);

      if (referenceMessage) {
        const embed = await getMessageLogEmbed(referenceMessage, true);
        embeds.push(embed);
      }
    }

    const embed = await getMessageLogEmbed(
      {
        guild_id: message.guild_id,
        message_id: message.id,
        author_id: message.author_id,
        channel_id: message.channel_id,
        sticker_id: message.sticker_id,
        created_at: new Date(message.created_at),
        content: message.content,
        attachments: message.attachments
      },
      false
    );

    embeds.push(embed);

    return new WebhookClient({ url: message_logging_webhook! }).send({ embeds }).catch(() => null);
  }

  public static async _attemptDiscordLog(
    message: DiscordMessage<true>,
    config: GuildConfig
  ): Promise<APIMessage | null> {
    if (!message.author || message.author.bot || message.webhookId !== null) {
      return null;
    }

    const { message_logging_webhook } = config;

    const sticker_id = message.stickers?.first()?.id ?? null;

    let embeds: EmbedBuilder[] = [];

    const embed = await getMessageLogEmbed(
      {
        guild_id: message.guildId,
        message_id: message.id,
        author_id: message.author.id,
        channel_id: message.channel.id,
        sticker_id,
        created_at: message.createdAt,
        content: message.content,
        attachments: Array.from(message.attachments.values()).map(attachment => attachment.url)
      },
      false
    );

    if (message.reference?.messageId) {
      const reference = message.reference && (await message.fetchReference().catch(() => null));
      const dbReference = await DatabaseManager.getMessageEntry(message.reference.messageId);

      if (reference) {
        const sticker_id = reference.stickers?.first()?.id ?? null;

        const embed = await getMessageLogEmbed(
          {
            guild_id: reference.guildId,
            message_id: reference.id,
            author_id: reference.author.id,
            channel_id: reference.channel.id,
            sticker_id,
            created_at: reference.createdAt,
            content: reference.content,
            attachments: Array.from(reference.attachments.values()).map(attachment => attachment.url)
          },
          true
        );

        embeds.push(embed);
      } else if (dbReference) {
        const sticker_id = dbReference.sticker_id;

        const embed = await getMessageLogEmbed(
          {
            guild_id: dbReference.guild_id,
            message_id: dbReference.id,
            author_id: dbReference.author_id,
            channel_id: dbReference.channel_id,
            sticker_id,
            created_at: new Date(Number(dbReference.created_at)),
            content: dbReference.content,
            attachments: dbReference.attachments
          },
          true
        );

        embeds.push(embed);
      }
    }

    embeds.push(embed);
    return new WebhookClient({ url: message_logging_webhook! }).send({ embeds }).catch(() => null);
  }
}
