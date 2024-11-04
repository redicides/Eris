import { Collection, PartialMessage, Snowflake, type Message as DiscordMessage } from 'discord.js';
import { Message } from '@prisma/client';

import { prisma } from '@/index';
import { GuildConfig } from '@utils/Types';

import Logger, { AnsiColor } from '@utils/Logger';
import { EMPTY_MESSAGE_CONTENT } from '@/utils/Constants';

export default class DatabaseManager {
  /**
   * Collection of messages that are queued to be added to the database.
   */
  private static readonly _dbQueue = new Collection<Snowflake, Message>();

  /**
   * The most recent message delete audit log entry.
   */

  private static _auditLogMessageEntries?: MessageDeleteAuditLog;

  /**
   * Retrieves the guild data for the specified guild from the database.
   * If the guild is not in the database, it creates a new entry and returns it.
   *
   * @param id The ID of the guild
   * @returns The guild data
   */

  public static async getGuildEntry(id: Snowflake): Promise<GuildConfig> {
    return DatabaseManager.confirmDatabaseGuildEntry(id);
  }

  /**
   * Creates a new guild in the database.
   *
   * @param guildId The ID of the guild to create
   * @returns The created guild
   */

  public static async createDatabaseGuildEntry(id: Snowflake): Promise<GuildConfig> {
    return await prisma.guild.create({
      data: { id }
    });
  }

  /**
   * Checks if the guild is in the database, and if not, creates a new entry.
   *
   * @param guildId The ID of the guild
   * @returns Guild The guild model
   */

  public static async confirmDatabaseGuildEntry(id: Snowflake): Promise<GuildConfig> {
    const guild = await prisma.guild.findUnique({
      where: {
        id
      }
    });

    return guild ? guild : DatabaseManager.createDatabaseGuildEntry(id);
  }

  /**
   * Retrieves a message from the database or the queue.
   *
   * @param id The ID of the message
   * @returns The message, or null if it does not exist
   */

  public static async getMessageEntry(id: Snowflake): Promise<Message | null> {
    let message = DatabaseManager._dbQueue.get(id) ?? null;

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
    DatabaseManager._dbQueue.set(message.id, messageEntry);
  }

  /**
   * Mark a message as deleted in the database.
   *
   * @param id The ID of the message to update
   * @returns The updated message, or null if it does not exist
   */

  public static async deleteMessageEntry(id: Snowflake) {
    let message = DatabaseManager._dbQueue.get(id) ?? null;

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
    const messages = DatabaseManager._dbQueue.filter(message => ids.includes(message.id) && !message.deleted);

    // Update the deletion state of the cached messages
    const deletedMessages = messages.map(message => {
      message.deleted = true;
      return message;
    });

    // Update whatever wasn't cached in the database
    if (messages.size !== deletedMessages.length) {
      const [current, updated] = await prisma.$transaction([
        prisma.message.updateMany({
          where: {
            id: { in: ids }
          },
          data: {
            deleted: true
          }
        }),
        prisma.message.findMany({
          where: {
            id: { in: ids }
          }
        })
      ]);

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
    const message = DatabaseManager._dbQueue.get(id);

    if (message) {
      const oldContent = message.content ?? EMPTY_MESSAGE_CONTENT;
      message.content = newContent;

      return oldContent;
    }

    const [oldMessage, updatedMessage] = await prisma.$transaction([
      prisma.message.findUnique({ where: { id } }),
      prisma.message.update({
        where: { id },
        data: { content: newContent }
      })
    ]);

    return oldMessage?.content ?? EMPTY_MESSAGE_CONTENT;
  }

  /**
   * Stores all cached messages in the database.
   */

  public static async storeMessageEntries() {
    Logger.info('Storing cached messages in the database...');

    const messages = Array.from(DatabaseManager._dbQueue.values());
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

    DatabaseManager._dbQueue.clear();

    if (!count) {
      Logger.info('No messages were stored in the database.');
    } else {
      Logger.info(`Stored ${count} messages in the database.`);
    }
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
    const stickerId = message.stickers?.first()?.id ?? null;
    const referenceId = message.reference?.messageId ?? null;

    return {
      id: message.id,
      guildId: message.guild.id,
      authorId: message.author.id,
      channelId: message.channel.id,
      channelParentId: message.channel.parent?.id ?? null,
      channelParentParentId: message.channel.parent?.parentId ?? null,
      stickerId,
      referenceId,
      content: message.content,
      attachments: message.attachments.map(attachment => attachment.url),
      createdAt: BigInt(message.createdAt.getTime()),
      deleted: false
    };
  }
}

interface MessageDeleteAuditLog {
  executorId: Snowflake;
  authorId: Snowflake;
  channelId: Snowflake;
  createdAt: bigint;
  count: number;
}
