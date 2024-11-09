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
  Message,
  InteractionReplyOptions,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedField
} from 'discord.js';
import { Infraction, InfractionFlag, InfractionType, Prisma } from '@prisma/client';

import { client, prisma } from '@/index';
import { capitalize, elipsify, generateSnowflakeId, hierarchyCheck, userMentionWithId } from '@utils/index';
import { GuildConfig, InteractionReplyData, Result } from '@utils/Types';

export default class InfractionManager {
  static async storeInfraction(data: Prisma.InfractionCreateArgs['data']): Promise<Infraction> {
    return prisma.infraction.create({ data });
  }

  static async getInfraction(where: Prisma.InfractionFindUniqueArgs['where']): Promise<Infraction | null> {
    return prisma.infraction.findUnique({
      where
    });
  }

  static async deleteInfraction(where: Prisma.InfractionDeleteArgs['where']): Promise<Infraction | null> {
    return prisma.infraction.delete({ where });
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
    config: GuildConfig;
    guild: Guild;
    target: GuildMember | User;
    executor: GuildMember;
    action: InfractionType;
    reason: string | null;
  }): Result {
    const { target, executor, action, guild, reason, config } = data;
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

    const reasonKey = `require${action}Reason` as keyof typeof config;

    if (config[reasonKey] && !reason) {
      return {
        success: false,
        message: `You must provide a reason to ${lAction} the provided ${target instanceof User ? 'user' : 'member'}.`
      };
    }

    return { success: true };
  }

  static async logInfraction(data: { config: GuildConfig; infraction: Infraction }): Promise<APIMessage | null> {
    const { config, infraction } = data;

    if (!config.infractionLoggingEnabled || !config.infractionLoggingWebhook) return null;
    const webhook = new WebhookClient({ url: config.infractionLoggingWebhook });

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${infraction.flag ? `${infraction.flag} ` : ''}${infraction.type} - ID #${infraction.id}`
      })
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
    config: GuildConfig;
    guild: Guild;
    target: GuildMember;
    infraction: Infraction;
  }): Promise<Message | null> {
    const { guild, target, infraction, config } = data;

    const key = `notify${infraction.type}Action` as keyof typeof config;
    if (!config[key]) return null;

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

  /**
   * Search a user for infractions.
   *
   * @param data.guildId The guild ID.
   * @param data.target The target user.
   * @param data.filter The filter to apply.
   * @param data.page The page number.
   * @returns Search results.
   */

  public static async searchInfractions(data: {
    guildId: Snowflake;
    controllerId: Snowflake;
    target: User;
    filter: InfractionFlag | null;
    page: number;
  }): Promise<InteractionReplyOptions> {
    const { guildId, controllerId, target, filter, page } = data;

    const skipMultiplier = page - 1;

    const infractionCount = await prisma.infraction.count({
      where: {
        guildId,
        targetId: target.id,
        flag: filter ?? undefined
      }
    });

    const infractions = await prisma.infraction.findMany({
      where: {
        guildId,
        targetId: target.id,
        flag: filter ?? undefined
      },
      skip: skipMultiplier * INFRACTIONS_PER_PAGE,
      take: INFRACTIONS_PER_PAGE,
      orderBy: {
        createdAt: 'desc'
      }
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.NotQuiteBlack)
      .setAuthor({
        name: `${filter ? `${filter} ` : ''}Infractions for @${target.username}`,
        iconURL: target.displayAvatarURL()
      })
      // Infraction pagination relies on this format
      .setFooter({ text: `User ID: ${target.id}` });

    const fields = await InfractionManager._getSearchFields(infractions);

    if (!fields.length) {
      embed.setDescription('No infractions found.');
    } else {
      embed.setFields(fields);
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    if (infractionCount > INFRACTIONS_PER_PAGE) {
      const totalPages = Math.ceil(infractionCount / INFRACTIONS_PER_PAGE);
      const paginationActionRow = InfractionManager._getPaginationButtons({
        page,
        totalPages,
        controllerId
      });

      components.push(paginationActionRow);
    }

    return { embeds: [embed], components, ephemeral: true };
  }

  /**
   * Get detailed information about an infraction.
   * @param data.id The infraction ID.
   * @param data.guildId The guild ID.
   * @returns Infraction details.
   */

  public static async getInfractionInfo(data: { id: string; guildId: Snowflake }): Promise<InteractionReplyData> {
    const { id, guildId } = data;

    const infraction = await InfractionManager.getInfraction({ id, guildId });

    if (!infraction) {
      return {
        error: 'The infraction could not be found.',
        temporary: true
      };
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${infraction.flag ? `${infraction.flag} ` : ''}${infraction.type} - ID #${infraction.id}` })
      .setColor(InfractionManager.mapActionToColor({ infraction }))
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

    return { embeds: [embed], ephemeral: true };
  }

  /**
   * Generate a unique infraction ID based on discord's snowflake.
   * @returns The generated infraction ID.
   */

  public static generateInfractionId(): string {
    return generateSnowflakeId();
  }

  private static async _getSearchFields(infractions: Infraction[]) {
    let fields: EmbedField[] = [];

    for (const infraction of infractions) {
      const executor = await client.users.fetch(infraction.executorId).catch(() => null);

      fields.push({
        name: `${infraction.type} #${infraction.id}, by ${
          executor ? `@${executor.username} (${executor.id})` : 'an unknown user'
        }`,
        value: `${elipsify(infraction.reason, 256)} - ${time(Math.floor(Number(infraction.createdAt) / 1000))}`,
        inline: false
      });

      continue;
    }

    return fields;
  }

  private static _getPaginationButtons(data: { page: number; totalPages: number; controllerId: Snowflake }) {
    const { page, totalPages, controllerId } = data;

    const isFirstPage = page === 1;
    const isLastPage = page === totalPages;

    const pageCountButton = new ButtonBuilder()
      .setLabel(`${page} / ${totalPages}`)
      .setCustomId('?')
      .setDisabled(true)
      .setStyle(ButtonStyle.Secondary);

    const nextButton = new ButtonBuilder()
      .setLabel('→')
      .setCustomId(`infraction-search-next-${controllerId}`)
      .setDisabled(isLastPage)
      .setStyle(ButtonStyle.Primary);

    const previousButton = new ButtonBuilder()
      .setLabel('←')
      .setCustomId(`infraction-search-back-${controllerId}`)
      .setDisabled(isFirstPage)
      .setStyle(ButtonStyle.Primary);

    if (totalPages > 2) {
      const firstPageButton = new ButtonBuilder()
        .setLabel('«')
        .setCustomId(`infraction-search-first-${controllerId}`)
        .setDisabled(isFirstPage)
        .setStyle(ButtonStyle.Primary);

      const lastPageButton = new ButtonBuilder()
        .setLabel('»')
        .setCustomId(`infraction-search-last-${controllerId}`)
        .setDisabled(isLastPage)
        .setStyle(ButtonStyle.Primary);

      return new ActionRowBuilder<ButtonBuilder>().setComponents(
        firstPageButton,
        previousButton,
        pageCountButton,
        nextButton,
        lastPageButton
      );
    } else {
      return new ActionRowBuilder<ButtonBuilder>().setComponents(previousButton, pageCountButton, nextButton);
    }
  }
}

export const INFRACTIONS_PER_PAGE = 5;

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
