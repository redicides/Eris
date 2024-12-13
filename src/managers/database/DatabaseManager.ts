import { Collection, PartialMessage, Snowflake, type Message as DiscordMessage } from 'discord.js';
import { Message } from '@prisma/client';

import { prisma } from '@/index';
import { GuildConfig } from '@utils/Types';
import { EmptyMessageContent } from '@utils/Constants';

import Logger, { AnsiColor } from '@utils/Logger';

export default class DatabaseManager {
  /**
   * Collection of messages that are queued to be added to the database.
   */
  private static readonly _messageQueue = new Collection<Snowflake, Message>();

  /**
   * Retrieves the guild data for the specified guild from the database.
   * If the guild is not in the database, it creates a new entry and returns it.
   *
   * @param id The ID of the guild
   * @returns The guild data
   */

  public static async getGuildEntry(id: Snowflake): Promise<GuildConfig> {
    const guild = await prisma.guild.findUnique({
      where: {
        id
      }
    });

    return guild ?? DatabaseManager.createDatabaseGuildEntry(id);
  }

  /**
   * Creates a new guild in the database.
   *
   * @param id The ID of the guild to create
   * @returns The created guild
   */

  public static async createDatabaseGuildEntry(id: Snowflake): Promise<GuildConfig> {
    return prisma.guild.create({
      data: { id }
    });
  }

  /**
   * Retrieves a message from the database or the queue.
   *
   * @param id The ID of the message
   * @returns The message, or null if it does not exist
   */

  public static async getMessageEntry(id: Snowflake): Promise<Message | null> {
    let message = DatabaseManager._messageQueue.get(id) ?? null;

    if (!message) {
      message = await prisma.message.findUnique({ where: { id } });
    }

    return message;
  }

  /**
   * Queues a message to be added to the database.
   * @param message The message to queue
   */

  public static queueMessageEntry(message: DiscordMessage<true>): void {
    const messageEntry = DatabaseManager.serializeMessageEntry(message);
    DatabaseManager._messageQueue.set(message.id, messageEntry);
  }

  /**
   * Mark a message as deleted in the database.
   *
   * @param id The ID of the message to update
   * @returns The updated message, or null if it does not exist
   */

  public static async deleteMessageEntry(id: Snowflake) {
    let message = DatabaseManager._messageQueue.get(id) ?? null;

    if (message) {
      message.deleted = true;
    } else {
      message = await prisma.message
        .update({
          data: { deleted: true },
          where: { id }
        })
        .catch(() => null);
    }

    return message;
  }

  /**
   * Marks a group of messages as deleted in the database.
   *
   * @param messageCollection The collection of messages to mark as deleted
   * @returns The updated messages
   */

  public static async bulkDeleteMessageEntries(
    messageCollection: Collection<Snowflake, PartialMessage | DiscordMessage<true>>
  ) {
    const ids = Array.from(messageCollection.keys());

    // Try to get the messages from cache
    const messages = DatabaseManager._messageQueue.filter(message => ids.includes(message.id) && !message.deleted);

    // Update the deletion state of the cached messages
    const deletedMessages = messages.map(message => {
      message.deleted = true;
      return message;
    });

    // Update whatever wasn't cached in the database
    if (messages.size !== deletedMessages.length) {
      await prisma.message.updateMany({
        where: {
          id: { in: ids }
        },
        data: {
          deleted: true
        }
      });

      const updated = await prisma.message.findMany({
        where: {
          id: { in: ids }
        }
      });

      // Merge the cached and stored messages
      return deletedMessages.concat(updated);
    }

    return deletedMessages;
  }

  /**
   * Update the content of a message in the database.
   *
   * @param id The ID of the message to update
   * @param newContent The new content of the message
   */

  public static async updateMessageEntry(id: Snowflake, newContent: string) {
    // Try to get the message from cache
    const message = DatabaseManager._messageQueue.get(id);

    if (message) {
      const oldContent = message.content ?? EmptyMessageContent;
      message.content = newContent;

      return oldContent;
    }

    const oldMessage = await prisma.message.findUnique({ where: { id } });

    await prisma.message
      .update({
        where: { id },
        data: { content: newContent }
      })
      .catch(() => null);

    return oldMessage?.content ?? EmptyMessageContent;
  }

  /**
   * Stores all cached messages in the database.
   */

  public static async storeMessageEntries() {
    Logger.info('Storing cached messages in the database...');

    const messages = Array.from(DatabaseManager._messageQueue.values());
    let count = 0;

    for (const message of messages) {
      const { id, ...data } = message;

      const storedMessage = await prisma.message.upsert({
        where: { id: message.id },
        update: data,
        create: message
      });

      if (storedMessage) {
        count++;
      }
    }

    DatabaseManager._messageQueue.clear();

    if (!count) {
      Logger.info('No messages were stored in the database.');
    } else {
      Logger.info(`Stored ${count} messages in the database.`);
    }
  }

  /**
   * Upsert a channel lock entry in the database.
   *
   * @param id The ID of the channel to lock
   * @param guild_id The ID of the guild the channel belongs to
   * @param overwrites The permission overwrites to apply
   */

  public static async upsertChannelLockEntry(data: { id: Snowflake; guild_id: Snowflake; overwrites: bigint }) {
    const { id, guild_id, overwrites } = data;

    return prisma.channelLock.upsert({
      where: { id, guild_id },
      create: { id, guild_id, overwrites },
      update: { overwrites }
    });
  }

  /**
   * Starts cleanup operations for the database.
   */

  public static async startCleanupOperations(event: string) {
    Logger.log(event, 'Starting cleanup operations...', {
      color: AnsiColor.Red,
      full: true
    });

    try {
      await DatabaseManager.storeMessageEntries();
      await prisma.$disconnect();
    } catch (error) {
      Logger.error(`Cleanup operations failed:`, error);
    } finally {
      Logger.log(event, 'Cleanup operations complete.', { color: AnsiColor.Green, full: true });
    }
  }

  /**
   * Serializes a message to make it suitable for insertion into the database.
   *
   * @param message The message to serialize
   * @returns The serialized message
   */

  private static serializeMessageEntry(message: DiscordMessage<true>): Message {
    const sticker_id = message.stickers?.first()?.id ?? null;
    const reference_id = message.reference?.messageId ?? null;

    return {
      id: message.id,
      guild_id: message.guild.id,
      author_id: message.author.id,
      channel_id: message.channel.id,
      sticker_id,
      reference_id,
      content: message.content,
      attachments: message.attachments.map(attachment => attachment.url),
      created_at: BigInt(message.createdAt.getTime()),
      deleted: false
    };
  }
}
