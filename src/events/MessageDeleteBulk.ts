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
  AttachmentBuilder
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
    const channelIds = extractChannelIds(channel);

    if (!config.messageLoggingEnabled || !config.messageLoggingWebhook) {
      return;
    }

    if (channelIds.some(id => config.messageLoggingIgnoredChannels.includes(id))) {
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

    const { messageLoggingWebhook } = config;
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

  public static async _attemptDiscordLog(
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

    return new WebhookClient({ url: messageLoggingWebhook! })
      .send({ content: logContent, files: [file], components: [components], allowedMentions: { parse: [] } })
      .catch(() => null);
  }

  private static async _getDiscordEntries(messages: Collection<Snowflake, DiscordMessage<true>>) {
    const authorMentions: ReturnType<typeof userMention>[] = [];
    const entries: { entry: string; createdAt: bigint | number }[] = [];

    for (const message of messages.values()) {
      const authorMention = userMention(message.author.id);
      const entry = await formatMessageBulkDeleteLogEntry({
        authorId: message.author.id,
        createdAt: message.createdTimestamp,
        stickerId: null,
        messageContent: message.content
      });
      const subEntries = [entry];

      if (!authorMentions.includes(authorMention)) {
        authorMentions.push(authorMention);
      }

      if (message.reference?.messageId) {
        const reference = message.reference && (await message.fetchReference().catch(() => null));

        if (reference) {
          const referenceEntry = await formatMessageBulkDeleteLogEntry({
            authorId: reference.author.id,
            createdAt: reference.createdTimestamp,
            stickerId: null,
            messageContent: reference.content
          });

          subEntries.unshift(`REF: ${referenceEntry}`);
        } else {
          const dbReference = await DatabaseManager.getMessageEntry(message.reference.messageId).catch(() => null);

          if (dbReference) {
            const referenceEntry = await formatMessageBulkDeleteLogEntry({
              authorId: dbReference.authorId,
              createdAt: dbReference.createdAt,
              stickerId: null,
              messageContent: dbReference.content
            });

            subEntries.unshift(`REF: ${referenceEntry}`);
          }
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
      const entry = await formatMessageBulkDeleteLogEntry({
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
          const referenceEntry = await formatMessageBulkDeleteLogEntry({
            authorId: reference.authorId,
            createdAt: reference.createdAt,
            stickerId: null,
            messageContent: reference.content
          });

          subEntries.unshift(`REF: ${referenceEntry}`);
        } else {
          let discordReference = discordMessages.get(message.referenceId);

          if (discordReference) {
            const referenceEntry = await formatMessageBulkDeleteLogEntry({
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

  private static mapLogEntriesToFile(entries: string[]): AttachmentBuilder {
    const buffer = Buffer.from(entries.join('\n\n'), 'utf-8');
    return new AttachmentBuilder(buffer, { name: 'log-data.txt' });
  }
}
