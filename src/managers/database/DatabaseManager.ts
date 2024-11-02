import { prisma } from '@/index';
import { GuildConfig } from '@utils/Types';

export default class DatabaseManager {
  /**
   * Guild cache methods.
   */

  static guilds = {
    /**
     * Retrieves the guild model for the specified guild from the database.
     *
     * @param guildId - The ID of the guild
     * @returns Guild - The guild model
     */

    async get(guildId: string): Promise<GuildConfig> {
      return this.confirm(guildId);
    },

    /**
     * Confirms that the guild is in the database.
     *
     * @param guildId - The ID of the guild
     * @returns Guild - The guild model
     */

    async confirm(guildId: string): Promise<GuildConfig> {
      const guild = await prisma.guild.findUnique({
        where: {
          id: guildId
        }
      });

      if (guild) return guild;

      return this._create(guildId);
    },

    /**
     * Creates a new guild and caches it.
     *
     * @param guildId - The ID of the guild to create
     * @returns Guild - The created guild
     */

    async _create(guildId: string): Promise<GuildConfig> {
      const guild = await prisma.guild.create({
        data: { id: guildId }
      });

      return guild;
    }
  };
}
