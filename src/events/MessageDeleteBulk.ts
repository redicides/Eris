import {
  type PartialMessage,
  type Message as DiscordMessage,
  type APIMessage,
  type MessageCreateOptions,
  Events,
  Collection,
  Snowflake,
  GuildTextBasedChannel,
  EmbedBuilder,
  Colors,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  WebhookClient
} from 'discord.js';
import { type Message } from '@prisma/client';

import { channelMentionWithId, uploadData, userMentionWithId } from '@utils/index';
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
    const channelId = channel.id ?? channel.parent?.id ?? channel.parent?.parentId;

    if (!config.messageLoggingEnabled || !config.messageLoggingWebhook) {
      return;
    }

    if (config.messageLoggingIgnoredChannels.includes(channelId)) {
      return;
    }

    const filteredMessages = deletedMessages.filter(message => message.author !== null) as Collection<
      Snowflake,
      DiscordMessage<true>
    >;
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

    const embed = this._buildLogEmbed({ channelId });
    const options = await this._parseDiscordMessages(messages, embed);

    return new WebhookClient({ url: messageLoggingWebhook! }).send(options).catch(() => null);
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

    const embed = this._buildLogEmbed({ channelId });
    const options = await this._parseDatabaseMessages(messages, embed);

    return new WebhookClient({ url: messageLoggingWebhook! }).send(options).catch(() => null);
  }

  private static _buildLogEmbed(data: { channelId: Snowflake }): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setAuthor({ name: 'Messages Bulk Deleted' })
      .setFields([
        {
          name: 'Source Channel',
          value: channelMentionWithId(data.channelId)
        }
      ])
      .setTimestamp();
  }

  private static async _parseDiscordMessages(
    messages: Collection<Snowflake, DiscordMessage<true>>,
    embed: EmbedBuilder
  ): Promise<MessageCreateOptions> {
    const messagesArray = [...messages.values()];
    const firstMsg = messagesArray.at(-1)!;

    let prevUser = firstMsg.author.id;
    let logContent = `Sent by @${firstMsg.author.username} (${firstMsg.author.id}):\n- ${firstMsg.content}`;

    for (let i = messagesArray.length - 2; i >= 0; i--) {
      const message = messagesArray[i];

      if (prevUser === message.author.id) logContent += `\n- ${message.content}`;
      else logContent += `\n\nSent by @${message.author.username} (${message.author.id}):\n- ${message.content}`;

      prevUser = message.author.id;
    }

    const dataUrl = await uploadData(logContent, 'txt');

    const urlButton = new ButtonBuilder().setLabel('View Log Data').setStyle(ButtonStyle.Link).setURL(dataUrl);
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(urlButton);

    const authors = [...new Set(messages.map(message => userMentionWithId(message.author.id)))].join(', ');

    return {
      embeds: [embed.addFields({ name: 'Message Authors', value: authors })],
      components: [actionRow]
    };
  }

  private static async _parseDatabaseMessages(messages: Message[], embed: EmbedBuilder): Promise<MessageCreateOptions> {
    const firstMsg = messages.at(-1)!;
    const user = await client.users.fetch(firstMsg.authorId).catch(() => ({ username: 'unknown.user' }));

    let prevUser = firstMsg.authorId;
    let logContent = `Sent by @${user.username} (${firstMsg.authorId}):\n- ${firstMsg.content}`;

    for (let i = messages.length - 2; i >= 0; i--) {
      const message = messages[i];

      if (prevUser === message.authorId) logContent += `\n- ${message.content}`;
      else {
        const author = await client.users.fetch(message.authorId).catch(() => ({ username: 'unknown.user' }));
        logContent += `\n\nSent by @${author.username} (${message.authorId}):\n- ${message.content}`;
      }

      prevUser = message.authorId;
    }

    const dataUrl = await uploadData(logContent, 'txt');

    const urlButton = new ButtonBuilder().setLabel('View Log Data').setStyle(ButtonStyle.Link).setURL(dataUrl);
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(urlButton);

    const authors = [...new Set(messages.map(message => userMentionWithId(message.authorId)))].join(', ');

    return {
      embeds: [embed.addFields({ name: 'Message Authors', value: authors })],
      components: [actionRow]
    };
  }
}
