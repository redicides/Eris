import { PrismaClient } from '@prisma/client';

import { GuildCache } from '@utils/cache';

/**
 * Extends the Prisma client with custom methods to account for cache invalidation.
 */

export const ExtendedClient = new PrismaClient().$extends({
  query: {
    guild: {
      async update({ query, args }) {
        if (args.where.id) GuildCache.free(args.where.id);
        return query(args);
      },
      async delete({ query, args }) {
        if (args.where.id) GuildCache.free(args.where.id);
        return query(args);
      }
    }
  }
});
