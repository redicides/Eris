import { Infraction, Prisma } from '@prisma/client';

import { prisma } from '@/index';
import { Snowflake } from 'discord.js';

export default class InfractionManager {
  static async storeInfraction(data: Prisma.InfractionCreateArgs['data']): Promise<Infraction> {
    return prisma.infraction.create({ data });
  }

  static async getInfraction(options: Prisma.InfractionFindUniqueArgs): Promise<Infraction | null> {
    return prisma.infraction.findUnique({
      where: options.where,
      include: options.include
    });
  }

  static async deleteInfraction(options: Prisma.InfractionDeleteArgs): Promise<Infraction | null> {
    return prisma.infraction.delete({ where: options.where, include: options.include });
  }

  static async getActiveMute(options: { guildId: Snowflake; targetId: Snowflake }): Promise<Infraction | null> {
    return prisma.infraction.findFirst({
      where: {
        guildId: options.guildId,
        targetId: options.targetId,
        type: 'Mute'
      }
    });
  }
}
