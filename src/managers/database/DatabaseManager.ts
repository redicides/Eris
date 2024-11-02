import { prisma } from '@/index';
import { GuildConfig } from '@utils/Types';
import { Snowflake } from 'discord.js';

export default class DatabaseManager {
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
}
