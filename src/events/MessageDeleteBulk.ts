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
  AttachmentBuilder,
  User
} from 'discord.js';
import { type Message } from '@prisma/client';

import {
  channelMentionWithId,
  extractChannelIds,
  formatMessageBulkDeleteLogEntry,
  pluralize,
  uploadData
} from '@utils/index';
import { GuildConfig } from '@utils/Types';

import EventListener from '@terabyte/EventListener';
import DatabaseManager from '@managers/database/DatabaseManager';
import { client } from '..';

export default class MessageDeleteBulk extends EventListener {
  constructor() {
    super(Events.MessageBulkDelete);
  }

  async execute(
    deletedMessages: Collection<Snowflake, PartialMessage | DiscordMessage<true>>,
    channel: GuildTextBasedChannel
  ) {
    if (terabyte.maintenance) return;

    const config = await DatabaseManager.getGuildEntry(channel.guild.id);
    const channelIds = extractChannelIds(channel);

    if (!config.message_logging_enabled || !config.message_logging_webhook) {
      return;
    }

    if (channelIds.some(id => config.message_logging_ignored_channels.includes(id))) {
      return;
    }

    const filteredMessages = deletedMessages.filter(
      message => message.author !== null && !message.author.bot && message.webhookId === null
    ) as Collection<Snowflake, DiscordMessage<true>>;

    return MessageDeleteBulk.handleLog(filteredMessages, channel.id, config);
  }

  public static async handleLog(
    discordMessages: Collection<Snowflake, DiscordMessage<true>>,
    channelId: Snowflake,
    config: GuildConfig
  ): Promise<APIMessage | null> {
    const messages = await DatabaseManager.bulkDeleteMessageEntries(discordMessages);

    if (!messages.length) {
      return MessageDeleteBulk._attemptDiscordLog(discordMessages, channelId, config);
    }

    const { message_logging_webhook } = config;
    const { entries, authorMentions } = await MessageDeleteBulk._getDatabaseEntries(messages, discordMessages);

    const file = MessageDeleteBulk.mapLogEntriesToFile(entries);
    const dataUrl = await uploadData(entries.join('\n\n'), 'txt');
    const formattedMentions =
      authorMentions.length > 1
        ? authorMentions.slice(0, -1).join(', ') + ', and ' + authorMentions[authorMentions.length - 1]
        : authorMentions[0] || '';

    const logContent = `\`${messages.length}\` ${pluralize(
      messages.length,
      'message'
    )} sent by ${formattedMentions} deleted in ${channelMentionWithId(channelId)}.`;

    const urlButton = new ButtonBuilder().setLabel('Open In Browser').setStyle(ButtonStyle.Link).setURL(dataUrl);
    const components = new ActionRowBuilder<ButtonBuilder>().addComponents(urlButton);

    return new WebhookClient({ url: message_logging_webhook! })
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

  public static async _attemptDiscordLog(
    messages: Collection<Snowflake, DiscordMessage<true>>,
    channelId: Snowflake,
    config: GuildConfig
  ): Promise<APIMessage | null> {
    if (!messages.size) {
      return null;
    }

    const { message_logging_webhook } = config;
    const { entries, authorMentions } = await MessageDeleteBulk._getDiscordEntries(messages);

    const file = MessageDeleteBulk.mapLogEntriesToFile(entries);
    const dataUrl = await uploadData(entries.join('\n\n'), 'txt');
    const formattedMentions =
      authorMentions.length > 1
        ? authorMentions.slice(0, -1).join(', ') + ', and ' + authorMentions[authorMentions.length - 1]
        : authorMentions[0] || '';

    const logContent = `\`${messages.size}\` ${pluralize(
      messages.size,
      'message'
    )} sent by ${formattedMentions} deleted in ${channelMentionWithId(channelId)}.`;
    const urlButton = new ButtonBuilder().setLabel('Open In Browser').setStyle(ButtonStyle.Link).setURL(dataUrl);
    const components = new ActionRowBuilder<ButtonBuilder>().addComponents(urlButton);

    return new WebhookClient({ url: message_logging_webhook! })
      .send({ content: logContent, files: [file], components: [components], allowedMentions: { parse: [] } })
      .catch(() => null);
  }

  private static async _getDiscordEntries(
    messages: Collection<Snowflake, DiscordMessage<true>>
  ): Promise<{ entries: string[]; authorMentions: ReturnType<typeof userMention>[] }> {
    const authorMentions: ReturnType<typeof userMention>[] = [];
    const authorCache = new Map<Snowflake, User | { username: string; id: Snowflake }>();
    const entries: { entry: string; createdAt: Date }[] = [];

    for (const message of messages.values()) {
      const authorId = message.author.id;
      const authorMention = userMention(authorId);

      // Get author from cache or fetch if not cached
      let author = authorCache.get(authorId);

      if (!author) {
        author = await client.users.fetch(authorId).catch(() => ({
          username: 'unknown user',
          id: authorId
        }));

        authorCache.set(authorId, author);
      }

      const entry = await formatMessageBulkDeleteLogEntry({
        author,
        createdAt: message.createdAt,
        stickerId: null,
        messageContent: message.content
      });

      const subEntries = [entry];

      if (!authorMentions.includes(authorMention)) {
        authorMentions.push(authorMention);
      }

      if (message.reference?.messageId) {
        const reference = message.reference && (await message.fetchReference().catch(() => null));

        let referenceAuthor = authorCache.get(reference?.author.id!);

        if (!referenceAuthor) {
          referenceAuthor = await client.users.fetch(reference?.author.id!).catch(() => ({
            username: 'unknown user',
            id: reference?.author.id!
          }));

          authorCache.set(reference?.author.id!, referenceAuthor);
        }

        if (reference) {
          const referenceEntry = await formatMessageBulkDeleteLogEntry({
            author: reference.author,
            createdAt: reference.createdAt,
            stickerId: null,
            messageContent: reference.content
          });

          subEntries.unshift(`REF: ${referenceEntry}`);
        } else {
          const dbReference = await DatabaseManager.getMessageEntry(message.reference.messageId);

          if (dbReference) {
            const referenceEntry = await formatMessageBulkDeleteLogEntry({
              author: referenceAuthor,
              createdAt: dbReference.created_at,
              stickerId: null,
              messageContent: dbReference.content
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
    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Map entries to their string representation
    const mapped = entries.map(({ entry }) => entry);

    // Clear the cache to prevent unnecessary memory usage
    authorCache.clear();

    return { entries: mapped, authorMentions };
  }

  private static async _getDatabaseEntries(
    messages: Message[],
    discordMessages: Collection<Snowflake, DiscordMessage<true>>
  ): Promise<{ entries: string[]; authorMentions: ReturnType<typeof userMention>[] }> {
    const authorMentions: ReturnType<typeof userMention>[] = [];
    const authorCache = new Map<Snowflake, User | { username: string; id: Snowflake }>();
    const entries: { entry: string; createdAt: Date }[] = [];

    for (const message of messages.values()) {
      const authorMention = userMention(message.author_id);

      let author = authorCache.get(message.author_id);

      if (!author) {
        author = await client.users.fetch(message.author_id).catch(() => ({
          username: 'unknown user',
          id: message.author_id
        }));

        authorCache.set(message.author_id, author);
      }

      const entry = await formatMessageBulkDeleteLogEntry({
        author,
        createdAt: message.created_at,
        stickerId: null,
        messageContent: message.content
      });

      const subEntries = [entry];

      if (!authorMentions.includes(authorMention)) {
        authorMentions.push(authorMention);
      }

      if (message.reference_id) {
        const reference = await DatabaseManager.getMessageEntry(message.reference_id);

        let referenceAuthor = authorCache.get(reference?.author_id!);

        if (!referenceAuthor) {
          referenceAuthor = await client.users.fetch(reference?.author_id!).catch(() => ({
            username: 'unknown user',
            id: reference?.author_id!
          }));

          authorCache.set(reference?.author_id!, referenceAuthor);
        }

        if (reference) {
          const referenceEntry = await formatMessageBulkDeleteLogEntry({
            author: referenceAuthor,
            createdAt: reference.created_at,
            stickerId: null,
            messageContent: reference.content
          });

          subEntries.unshift(`REF: ${referenceEntry}`);
        } else {
          let discordReference = discordMessages.get(message.reference_id);

          if (discordReference) {
            const referenceEntry = await formatMessageBulkDeleteLogEntry({
              author: referenceAuthor,
              createdAt: discordReference.createdAt,
              stickerId: null,
              messageContent: discordReference.content
            });

            subEntries.unshift(`REF: ${referenceEntry}`);
          }
        }
      }

      entries.push({
        entry: subEntries.join('\n └── '),
        createdAt: message.created_at
      });
    }

    // Sort entries by creation date (newest to oldest)
    entries.sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Map entries to their string representation
    const mapped = entries.map(({ entry }) => entry);

    // Clear the cache to prevent unnecessary memory usage
    authorCache.clear();

    return { entries: mapped, authorMentions };
  }

  private static mapLogEntriesToFile(entries: string[]): AttachmentBuilder {
    const buffer = Buffer.from(entries.join('\n\n'), 'utf-8');
    return new AttachmentBuilder(buffer, { name: 'log-data.txt' });
  }
}
