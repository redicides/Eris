import { Guild, Infraction, Prisma } from '@prisma/client';

import { prisma } from '@/index';
import {
  APIMessage,
  Colors,
  EmbedBuilder,
  Interaction,
  Message,
  Snowflake,
  time,
  User,
  WebhookClient
} from 'discord.js';
import { userMentionWithId } from '@/utils';

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

  static async logInfraction(data: { config: Guild; infraction: Infraction }): Promise<APIMessage | null> {
    const { config, infraction } = data;

    if (!config.infractionLoggingEnabled || !config.infractionLoggingWebhook) return null;
    const webhook = new WebhookClient({ url: config.infractionLoggingWebhook });

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${infraction.type} #${infraction.id}` })
      .setColor(INFRACTION_COLORS[infraction.type])
      .setFields([
        { name: 'Executor', value: userMentionWithId(infraction.executorId) },
        { name: 'Target', value: userMentionWithId(infraction.targetId) },
        { name: 'Reason', value: infraction.reason }
      ])
      .setTimestamp(Number(infraction.createdAt));

    if (infraction.expiresAt)
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager.formatExpiration(infraction.expiresAt)
      });

    return webhook.send({ embeds: [embed] }).catch(() => null);
  }

  public static formatExpiration(expiration: bigint | number | null): string {
    return expiration === null
      ? 'Never'
      : `${time(Math.floor(Number(expiration) / 1000))} (${time(Math.floor(Number(expiration) / 1000), 'R')})`;
  }
}

export const PAST_TENSE_INFRACTIONS = {
  ban: 'banned',
  kick: 'kicked',
  mute: 'muted',
  warn: 'warned',
  unban: 'unbanned',
  unmute: 'unmuted'
};

export const INFRACTION_COLORS = {
  Warn: Colors.Yellow,
  Mute: 0xef975c,
  Kick: Colors.Orange,
  Ban: Colors.Red,
  Unmute: Colors.Green,
  Unban: Colors.Green
};
