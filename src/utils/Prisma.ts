import CacheManager from '@managers/database/CacheManager';

import { PrismaClient } from '@prisma/client';

/**
 * Extends the Prisma client with custom methods to account for cache invalidation.
 */

export const ExtendedClient = new PrismaClient().$extends({
  query: {
    guild: {
      async update({ query, args }) {
        if (args.where.id) CacheManager.guilds.free(args.where.id);
        return query(args);
      },
      async delete({ query, args }) {
        if (args.where.id) CacheManager.guilds.free(args.where.id);
        return query(args);
      }
    },

   permission: {
      async create({ query, args }) { 
        if (args.data.guildId) CacheManager.guilds.free(args.data.guildId);

        return query(args);
      },
      async update({ query, args }) {
        const result = await query(args);
        if (result && result.guildId) CacheManager.guilds.free(result.guildId);

        return result;
      },
      async delete({ query, args }) {
        if (args.where.guildId) CacheManager.guilds.free(args.where.guildId);

        return query(args);
      }
    }
  }
});
