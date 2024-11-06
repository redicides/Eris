import {
  type PartialMessage,
  type Message as DiscordMessage,
  type APIMessage,
  Events,
  Collection,
  Snowflake,
  GuildTextBasedChannel,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  WebhookClient,
  userMention,
  StickerFormatType,
  AttachmentBuilder
} from 'discord.js';
import { type Message } from '@prisma/client';

import { channelMentionWithId, pluralize, uploadData } from '@utils/index';
import { EMPTY_MESSAGE_CONTENT, LOG_ENTRY_DATE_FORMAT } from '@utils/Constants';
import { GuildConfig } from '@utils/Types';
import { client } from '..';

import EventListener from '@managers/events/EventListener';
import DatabaseManager from '@managers/database/DatabaseManager';

export default class MessageDeleteBulk extends EventListener {
  constructor() {
    super(Events.MessageBulkDelete);
  }

  async execute(
    deletedMessages: Collection<Snowflake, PartialMessage | DiscordMessage<true>>,
    channel: GuildTextBasedChannel
  ) {
    const config = await DatabaseManager.getGuildEntry(channel.guild.id);
    const channelId = channel.id || channel.parent?.id || channel.parent?.parentId;

    if (!config.messageLoggingEnabled || !config.messageLoggingWebhook) {
      return;
    }

    if (config.messageLoggingIgnoredChannels.includes(channelId)) {
      return;
    }

    const filteredMessages = deletedMessages.filter(
      message => message.author !== null && !message.author.bot && message.webhookId === null
    ) as Collection<Snowflake, DiscordMessage<true>>;
    const messages = await DatabaseManager.bulkDeleteMessageEntries(filteredMessages);

    if (config.messageLoggingStoreMessages) {
      return MessageDeleteBulk.handleEnhancedLog(messages, filteredMessages, channel.id, config);
    } else {
      return MessageDeleteBulk.handleNormalLog(filteredMessages, channel.id, config);
    }
  }

  public static async handleNormalLog(
    messages: Collection<Snowflake, DiscordMessage<true>>,
    channelId: Snowflake,
    config: GuildConfig
  ): Promise<APIMessage | null> {
    if (!messages.size) {
      return null;
    }

    const { messageLoggingWebhook } = config;
    const { entries, authorMentions } = await MessageDeleteBulk._getDiscordEntries(messages);

    const file = MessageDeleteBulk.mapLogEntriesToFile(entries);
    const dataUrl = await uploadData(entries.join('\n\n'), 'txt');

    const logContent = `\`${messages.size}\` ${pluralize(messages.size, 'message')} deleted in ${channelMentionWithId(
      channelId
    )} - ${authorMentions.join(', ')}.`;
    const urlButton = new ButtonBuilder().setLabel('Open In Browser').setStyle(ButtonStyle.Link).setURL(dataUrl);
    const components = new ActionRowBuilder<ButtonBuilder>().addComponents(urlButton);

    return new WebhookClient({ url: messageLoggingWebhook! })
      .send({ content: logContent, files: [file], components: [components], allowedMentions: { parse: [] } })
      .catch(() => null);
  }

  public static async handleEnhancedLog(
    messages: Message[],
    discordMessages: Collection<Snowflake, DiscordMessage<true>>,
    channelId: Snowflake,
    config: GuildConfig
  ): Promise<APIMessage | null> {
    if (!messages.length) {
      return MessageDeleteBulk.handleNormalLog(discordMessages, channelId, config);
    }

    const { messageLoggingWebhook } = config;
    const { entries, authorMentions } = await MessageDeleteBulk._getDatabaseEntries(messages, discordMessages);

    const file = MessageDeleteBulk.mapLogEntriesToFile(entries);
    const dataUrl = await uploadData(entries.join('\n\n'), 'txt');

    const logContent = `\`${messages.length}\` ${pluralize(
      messages.length,
      'message'
    )} deleted in ${channelMentionWithId(channelId)} - ${authorMentions.join(', ')}.`;
    const urlButton = new ButtonBuilder().setLabel('Open In Browser').setStyle(ButtonStyle.Link).setURL(dataUrl);
    const components = new ActionRowBuilder<ButtonBuilder>().addComponents(urlButton);

    return new WebhookClient({ url: messageLoggingWebhook! })
      .send({
        content: logContent,
        files: [file],
        components: [components],
        allowedMentions: {
          parse: []
        }
      })
      .catch(() => null);
  }

  private static async _getDiscordEntries(messages: Collection<Snowflake, DiscordMessage<true>>) {
    const authorMentions: ReturnType<typeof userMention>[] = [];
    const entries: { entry: string; createdAt: bigint | number }[] = [];

    for (const message of messages.values()) {
      const authorMention = userMention(message.author.id);
      const entry = await MessageDeleteBulk._formatBulkMessageLogEntry({
        authorId: message.author.id,
        createdAt: message.createdTimestamp,
        stickerId: null,
        messageContent: message.content
      });
      const subEntries = [entry];

      if (!authorMentions.includes(authorMention)) {
        authorMentions.push(authorMention);
      }

      if (message.reference) {
        const reference = message.reference && (await message.fetchReference().catch(() => null));

        if (reference) {
          const referenceEntry = await MessageDeleteBulk._formatBulkMessageLogEntry({
            authorId: reference.author.id,
            createdAt: reference.createdTimestamp,
            stickerId: null,
            messageContent: reference.content
          });

          subEntries.unshift(`REF: ${referenceEntry}`);
        }
      }

      entries.push({
        entry: subEntries.join('\n └── '),
        createdAt: message.createdTimestamp
      });
    }

    // Sort entries by creation date (newest to oldest)
    entries.sort((a, b) => {
      return new Date(Number(b.createdAt)).getTime() - new Date(Number(a.createdAt)).getTime();
    });

    const mappedEntries = entries.map(({ entry }) => entry);

    return { entries: mappedEntries, authorMentions };
  }

  private static async _getDatabaseEntries(
    messages: Message[],
    discordMessages: Collection<Snowflake, DiscordMessage<true>>
  ) {
    const authorMentions: ReturnType<typeof userMention>[] = [];
    const entries: { entry: string; createdAt: bigint | number }[] = [];

    for (const message of messages.values()) {
      const authorMention = userMention(message.authorId);
      const entry = await MessageDeleteBulk._formatBulkMessageLogEntry({
        authorId: message.authorId,
        createdAt: message.createdAt,
        stickerId: null,
        messageContent: message.content
      });
      const subEntries = [entry];

      if (!authorMentions.includes(authorMention)) {
        authorMentions.push(authorMention);
      }

      if (message.referenceId) {
        const reference = await DatabaseManager.getMessageEntry(message.referenceId).catch(() => null);

        if (reference) {
          const referenceEntry = await MessageDeleteBulk._formatBulkMessageLogEntry({
            authorId: reference.authorId,
            createdAt: reference.createdAt,
            stickerId: null,
            messageContent: reference.content
          });

          subEntries.unshift(`REF: ${referenceEntry}`);
        } else {
          let discordReference = discordMessages.get(message.referenceId);

          if (discordReference) {
            const referenceEntry = await MessageDeleteBulk._formatBulkMessageLogEntry({
              authorId: discordReference.author.id,
              createdAt: discordReference.createdTimestamp,
              stickerId: null,
              messageContent: discordReference.content
            });

            subEntries.unshift(`REF: ${referenceEntry}`);
          }
        }
      }

      entries.push({
        entry: subEntries.join('\n └── '),
        createdAt: message.createdAt
      });
    }

    // Sort entries by creation date (newest to oldest)
    entries.sort((a, b) => {
      return new Date(Number(b.createdAt)).getTime() - new Date(Number(a.createdAt)).getTime();
    });

    const mappedEntries = entries.map(({ entry }) => entry);

    return { entries: mappedEntries, authorMentions };
  }

  public static async _formatBulkMessageLogEntry(data: {
    createdAt: bigint | number;
    stickerId: Snowflake | null;
    authorId: Snowflake;
    messageContent: string | null;
  }) {
    const timestamp = new Date(Number(data.createdAt)).toLocaleString(undefined, LOG_ENTRY_DATE_FORMAT);
    const author = await client.users.fetch(data.authorId).catch(() => ({ username: 'unknown.user' }));

    let content: string | undefined;

    if (data.stickerId) {
      const sticker = await client.fetchSticker(data.stickerId).catch(() => null);

      if (sticker && sticker.format === StickerFormatType.Lottie) {
        content = `Lottie Sticker "${sticker.name}": ${data.stickerId}`;
      } else if (sticker) {
        content = `Sticker "${sticker.name}": ${sticker.url}`;
      }

      if (data.messageContent && content) {
        content = ` | Message Content: ${data.messageContent}`;
      }
    }

    content ??= data.messageContent ?? EMPTY_MESSAGE_CONTENT;
    return `[${timestamp}] @${author.username} (${data.authorId}) - ${content}`;
  }

  private static mapLogEntriesToFile(entries: string[]): AttachmentBuilder {
    const buffer = Buffer.from(entries.join('\n\n'), 'utf-8');
    return new AttachmentBuilder(buffer, { name: 'log-data.txt' });
  }
}
