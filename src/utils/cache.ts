import { Guild } from '@prisma/client';
import { Collection } from 'discord.js';

import { prisma } from '@/index';

export class GuildCache {
  /**
   * Collection cache for guilds to avoid database queries.
   */

  private static cache = new Collection<string, Guild>();

  /**
   * Retrieves the guild model for the specified guild from the database.
   *
   * @param guildId - The ID of the guild
   * @returns Guild - The guild model
   */

  public static async get(guildId: string): Promise<Guild> {
    if (this.cache.has(guildId)) return this.cache.get(guildId)!;
    return this.confirm(guildId);
  }

  /**
   * Confirms that the guild is in the database.
   *
   * @param guildId - The ID of the guild
   * @returns Guild - The guild model
   */

  public static async confirm(guildId: string): Promise<Guild> {
    const guild = await prisma.guild.findUnique({
      where: {
        id: guildId
      }
    });

    if (guild) {
      this.cache.set(guildId, guild);
      return guild;
    }

    return this._create(guildId);
  }

  /**
   * Creates a new guild and caches it.
   *
   * @param guildId - The ID of the guild to create
   * @returns Guild - The created guild
   */

  private static async _create(guildId: string): Promise<Guild> {
    const guild = await prisma.guild.create({
      data: { id: guildId }
    });

    this.cache.set(guildId, guild);
    return guild;
  }

  /**
   * Removes a guild from the cache (most likely due to an update or deletion).
   *
   * @param guildId - The ID of the guild to remove
   * @returns boolean - If the guild was present in the cache and is now wiped
   */

  public static free(guildId: string): boolean {
    return this.cache.delete(guildId);
  }

  /**
   * Removes all guilds from the cache.
   */

  public static freeAll(): void {
    return this.cache.clear();
  }
}
