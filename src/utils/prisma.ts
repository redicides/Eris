import { PrismaClient } from '@prisma/client';

import GuildCache from '@managers/database/GuildCache';

/**
 * Extends the Prisma client with custom methods to account for cache invalidation.
 */

export const ExtendedClient = new PrismaClient().$extends({
  query: {
    guild: {
      async update({ query, args }) {
        const result = await query(args);
        GuildCache.wipeCache(args.where.id!);
        return result;
      },
      async delete({ query, args }) {
        const result = await query(args);
        GuildCache.wipeCache(args.where.id!);
        return result;
      }
    }
  }
});
