import {
  APIMessage,
  EmbedBuilder,
  GuildMember,
  Snowflake,
  WebhookClient,
  Guild,
  User,
  Colors,
  time,
  Message
} from 'discord.js';
import { Infraction, InfractionType, Prisma } from '@prisma/client';

import { client, prisma } from '@/index';
import { capitalize, hierarchyCheck, userMentionWithId } from '@utils/index';
import { GuildConfig, Result } from '@utils/Types';

export default class InfractionManager {
  static async storeInfraction(data: Prisma.InfractionCreateArgs['data']): Promise<Infraction> {
    return prisma.infraction.create({ data });
  }

  static async getInfraction(options: Prisma.InfractionFindUniqueArgs): Promise<Infraction | null> {
    return prisma.infraction.findUnique({
      where: options.where,
      include: options.include,
      select: options.select
    });
  }

  static async deleteInfraction(options: Prisma.InfractionDeleteArgs): Promise<Infraction | null> {
    return prisma.infraction.delete({ where: options.where, include: options.include, select: options.select });
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

  public static validateAction(data: {
    guild: Guild;
    target: GuildMember | User;
    executor: GuildMember;
    action: InfractionType;
  }): Result {
    const { target, executor, action, guild } = data;
    const lAction = action.toLowerCase();

    if (executor.id === target.id) return { success: false, message: `You cannot ${lAction} yourself.` };
    if (target.id === client.user!.id) return { success: false, message: `You cannot ${lAction} me.` };

    if (target.id === guild.ownerId) return { success: false, message: `You cannot ${lAction} the server owner.` };

    if (target instanceof GuildMember) {
      if (!hierarchyCheck(executor, target))
        return { success: false, message: `You cannot ${lAction} someone with higher or equal roles than you.` };

      if (action !== InfractionType.Warn && !hierarchyCheck(guild.members.me!, target))
        return { success: false, message: `I cannot ${lAction} someone with higher or equal roles than me.` };

      if (action === InfractionType.Unmute && !target.isCommunicationDisabled())
        return { success: false, message: `You cannot ${lAction} someone who is not muted.` };

      if (target.permissions.has('Administrator') && action === 'Mute')
        return { success: false, message: `You cannot mute an administrator.` };
    }

    return { success: true };
  }

  static async logInfraction(data: { config: GuildConfig; infraction: Infraction }): Promise<APIMessage | null> {
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

  static async sendNotificationDM(data: {
    guild: Guild;
    target: GuildMember;
    infraction: Infraction;
  }): Promise<Message | null> {
    const { guild, target, infraction } = data;

    const embed = new EmbedBuilder()
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
      .setColor(INFRACTION_COLORS[infraction.type])
      .setTitle(
        `You've been ${InfractionManager.getPastTense(infraction.type)} ${InfractionManager.getPreposition(
          infraction.type
        )} ${guild.name}`
      )
      .setFields([{ name: 'Reason', value: infraction.reason }])
      .setFooter({ text: `Infraction ID: ${infraction.id}` })
      .setTimestamp(Number(infraction.createdAt));

    if (infraction.expiresAt)
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager.formatExpiration(infraction.expiresAt)
      });

    return target.send({ embeds: [embed] }).catch(() => null);
  }

  public static async resolvePunishment(data: {
    guild: Guild;
    executor: GuildMember;
    target: GuildMember | User;
    action: Exclude<InfractionType, 'Warn'>;
    reason: string;
    duration: number | null;
    deleteMessages?: number;
  }) {
    const { guild, executor, target, action, duration, reason } = data;

    switch (action) {
      case 'Mute':
        return (target as GuildMember).timeout(
          duration,
          InfractionManager.formatAuditLogReason(executor, action, reason)
        );

      case 'Kick':
        return guild.members.kick(target.id, InfractionManager.formatAuditLogReason(executor, action, reason));

      case 'Ban':
        return guild.members.ban(target.id, {
          reason: InfractionManager.formatAuditLogReason(executor, action, reason),
          deleteMessageSeconds: data.deleteMessages
        });

      case 'Unban':
        return guild.members.unban(target.id, InfractionManager.formatAuditLogReason(executor, action, reason));

      case 'Unmute':
        return (target as GuildMember).timeout(null, InfractionManager.formatAuditLogReason(executor, action, reason));
    }
  }

  private static formatAuditLogReason(
    executor: GuildMember,
    punishment: Exclude<InfractionType, 'Warn'>,
    reason: string
  ): string {
    return `[${capitalize(InfractionManager.getPastTense(punishment))} by ${executor.user.username} (${
      executor.id
    })] ${reason}`;
  }

  private static getPreposition(type: InfractionType): string {
    return type === 'Ban' || type === 'Unban' ? 'from' : 'in';
  }

  private static getPastTense(type: InfractionType): string {
    return PAST_TENSE_INFRACTIONS[type.toLowerCase() as keyof typeof PAST_TENSE_INFRACTIONS];
  }

  public static formatExpiration(expiration: bigint | number | null): string {
    return expiration === null
      ? 'Never'
      : `${time(Math.floor(Number(expiration) / 1000))} (${time(Math.floor(Number(expiration) / 1000), 'R')})`;
  }

  public static getSuccessMessage(data: { target: GuildMember | User; infraction: Infraction }): string {
    const { target, infraction } = data;
    const { type, id, expiresAt } = infraction;

    const relativeExpiration = expiresAt ? `${time(Math.floor(Number(infraction.expiresAt) / 1000), 'R')}` : '';
    const expirationText = expiresAt ? `${time(Math.floor(Number(infraction.expiresAt) / 1000))}` : '';

    const message: Record<Infraction['type'], string> = {
      Warn: `Successfully added a warning for ${target}${expiresAt ? ` that will expire ${relativeExpiration}` : ''}`,
      Mute: `Successfully set ${target} on a timeout that will end ${relativeExpiration}`,
      Kick: `Successfully kicked ${target}`,
      Ban: `Successfully banned ${target}${expiresAt ? ` until ${expirationText}` : ''}`,
      Unmute: `Successfully unmuted ${target}`,
      Unban: `Successfully unbanned ${target}`
    };

    return `${message[type]} - ID \`#${id}\``;
  }

  public static mapActionToColor(data: { infraction: Infraction }): number {
    return INFRACTION_COLORS[data.infraction.type];
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

export const DEFAULT_INFRACTION_REASON = 'No reason provided.';
