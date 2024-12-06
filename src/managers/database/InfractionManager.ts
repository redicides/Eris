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
  EmbedField,
  userMention
} from 'discord.js';
import { Infraction, InfractionFlag, InfractionType, Prisma } from '@prisma/client';

import { MessageKeys } from '@utils/Keys';
import { client, prisma } from '@/index';
import { capitalize, elipsify, generateSnowflakeId, hierarchyCheck, userMentionWithId } from '@utils/index';
import { GuildConfig, InteractionReplyData, Result } from '@utils/Types';

import TaskManager from './TaskManager';

export default class InfractionManager {
  /**
   * Store an infraction in the database.
   *
   * @param data The infraction data
   * @returns The stored infraction
   */
  static async storeInfraction(data: Prisma.InfractionCreateArgs['data']): Promise<Infraction> {
    return prisma.infraction.create({ data });
  }

  /**
   * Retrieve an infraction from the database.
   *
   * @param where The infraction query
   * @returns The infraction, if found
   */

  static async getInfraction(where: Prisma.InfractionFindUniqueArgs['where']): Promise<Infraction | null> {
    return prisma.infraction.findUnique({
      where
    });
  }

  /**
   * Delete an infraction from the database.
   *
   * @param where The infraction query
   * @returns The deleted infraction, if found
   */

  static async deleteInfraction(where: Prisma.InfractionDeleteArgs['where']): Promise<Infraction | null> {
    return prisma.infraction.delete({ where });
  }

  /**
   * Check if a user has an active mute.
   *
   * @param options.guildId The guild ID
   * @param options.target_id The target user ID
   * @returns The active mute, if found
   */

  static async getActiveMute(options: { guild_id: Snowflake; target_id: Snowflake }): Promise<Infraction | null> {
    return prisma.infraction.findFirst({
      where: {
        ...options,
        type: 'Mute'
      }
    });
  }

  /**
   * Validate an moderation action.
   *
   * @param data.config The guild configuration
   * @param data.guild The guild where the action is taking place
   * @param data.target The target user
   * @param data.executor The executor of the action
   * @param data.action The type of action
   * @param data.reason The reason for the action
   * @returns The validation result
   */

  public static validateAction(data: {
    config: GuildConfig;
    guild: Guild;
    target: GuildMember | User;
    executor: GuildMember;
    action: InfractionType;
    reason: string | null;
  }): Result {
    const { target, executor, action, guild, reason, config } = data;

    if (executor.id === target.id) return { success: false, message: MessageKeys.Errors.CantPunishSelf(action) };
    if (target.id === client.user!.id) return { success: false, message: MessageKeys.Errors.CantPunishBot(action) };

    if (target.id === guild.ownerId)
      return { success: false, message: MessageKeys.Errors.CantPunishServerOwner(action) };

    if (target instanceof GuildMember) {
      if (!hierarchyCheck(executor, target))
        return { success: false, message: MessageKeys.Errors.InadequateUserHierarchy(action.toLocaleLowerCase()) };

      if (action !== InfractionType.Warn && !hierarchyCheck(guild.members.me!, target))
        return { success: false, message: MessageKeys.Errors.InadequateBotHierarchy(action.toLocaleLowerCase()) };

      if (action === InfractionType.Unmute && !target.isCommunicationDisabled())
        return { success: false, message: MessageKeys.Errors.CantUnmuteUnmutedMember };

      if (target.permissions.has('Administrator') && action === 'Mute')
        return { success: false, message: MessageKeys.Errors.CantMuteAdmin };
    }

    const reasonKey = `require_${action.toLowerCase()}_reason` as keyof typeof config;

    if (config[reasonKey] && !reason) {
      return {
        success: false,
        message: MessageKeys.Errors.ReasonRequired(
          `${action.toLowerCase()} the provided ${target instanceof User ? 'user' : 'member'}`
        )
      };
    }

    return { success: true };
  }

  /**
   * Log an infraction to the infraction logging webhook.
   *
   * @param data.config The guild configuration
   * @param data.infraction The infraction to log
   * @returns The sent message, if successful
   */

  static async logInfraction(data: { config: GuildConfig; infraction: Infraction }): Promise<APIMessage | null> {
    const { config, infraction } = data;

    if (!config.infraction_logging_enabled || !config.infraction_logging_webhook) return null;
    const webhook = new WebhookClient({ url: config.infraction_logging_webhook });

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${infraction.flag ? `${infraction.flag} ` : ''}${infraction.type} - ID #${infraction.id}`
      })
      .setColor(INFRACTION_COLORS[infraction.type])
      .setFields([
        { name: 'Executor', value: userMentionWithId(infraction.executor_id) },
        { name: 'Target', value: userMentionWithId(infraction.target_id) },
        { name: 'Reason', value: infraction.reason }
      ])
      .setTimestamp(Number(infraction.created_at));

    if (infraction.expires_at) {
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager.formatExpiration(infraction.expires_at)
      });
    }

    if (infraction.request_author_id) {
      embed.spliceFields(1, 0, { name: 'Requested By', value: userMentionWithId(infraction.request_author_id) });
    }

    if (infraction.request_id) {
      embed.setFooter({ text: `Request ID: #${infraction.request_id}` });
    }

    return webhook.send({ embeds: [embed] }).catch(() => null);
  }

  /**
   * Notify a user of an infraction.
   *
   * @param data.config The guild configuration
   * @param data.guild The guild where tje infraction was issued from
   * @param data.target The target user
   * @param data.infraction The infraction that was issued
   * @returns The sent message, if successful
   */

  static async sendNotificationDM(data: {
    config: GuildConfig;
    guild: Guild;
    target: GuildMember;
    infraction: Infraction;
    info?: string;
  }): Promise<Message | null> {
    const { guild, target, infraction, config, info } = data;

    const notificationKey = `notify_${infraction.type.toLowerCase()}_action` as keyof typeof config;
    const additionalInfoKey = `default_additional_${infraction.type.toLowerCase()}_info` as keyof typeof config;
    const additionalInfo = info ?? (config[additionalInfoKey] as string | null);

    if (!config[notificationKey]) return null;

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
      .setTimestamp(Number(infraction.created_at));

    if (infraction.expires_at) {
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager.formatExpiration(infraction.expires_at)
      });
    }

    if (additionalInfo) {
      embed.spliceFields(1, 0, {
        name: 'Additional Information',
        value: additionalInfo
      });
    }

    return target.send({ embeds: [embed] }).catch(() => null);
  }

  /**
   * Resolve a punishment action.
   *
   * @param data.guild The guild where the action is taking place
   * @param data.executor The executor of the action
   * @param data.target The target user
   * @param data.action The type of action
   * @param data.reason The reason for the action
   * @param data.duration The duration of the action
   * @param data.deleteMessages The number of messages to delete upon ban
   * @returns The resolved punishment
   */

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

  /**
   * Format an expiration date.
   *
   * @param expiration The expiration date
   * @returns The formatted expiration date
   */

  public static formatExpiration(expiration: bigint | number | null): string {
    return expiration === null
      ? 'Never'
      : `${time(Math.floor(Number(expiration) / 1000))} (${time(Math.floor(Number(expiration) / 1000), 'R')})`;
  }

  /**
   * Get the success message when issuing an infraction.
   *
   * @param data.target The target user
   * @param data.infraction The issued infraction
   * @returns The success message
   */

  public static getSuccessMessage(data: { target: GuildMember | User; infraction: Infraction }): string {
    const { target, infraction } = data;
    const { type, id, expires_at } = infraction;

    const relativeExpiration = expires_at ? `${time(Math.floor(Number(infraction.expires_at) / 1000), 'R')}` : '';
    const expiration = expires_at ? `${time(Math.floor(Number(infraction.expires_at) / 1000))}` : '';

    const message: Record<Infraction['type'], string> = {
      Warn: `Successfully added a warning for ${target}${expires_at ? ` that will expire ${relativeExpiration}` : ''}`,
      Mute: `Successfully set ${target} on a timeout that will end ${relativeExpiration}`,
      Kick: `Successfully kicked ${target}`,
      Ban: `Successfully banned ${target}${expires_at ? ` until ${expiration}` : ''}`,
      Unmute: `Successfully unmuted ${target}`,
      Unban: `Successfully unbanned ${target}`
    };

    return `${message[type]} - ID \`#${id}\``;
  }

  /**
   * Map an infraction type to a color.
   *
   * @param data.infraction The infraction
   * @returns The color
   */

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
    guild_id: Snowflake;
    controller_id: Snowflake;
    target: User;
    filter: InfractionFlag | null;
    page: number;
  }): Promise<InteractionReplyOptions> {
    const { guild_id, controller_id, target, filter, page } = data;

    const skipMultiplier = page - 1;

    const infractionCount = await prisma.infraction.count({
      where: {
        guild_id,
        target_id: target.id,
        flag: filter ?? undefined
      }
    });

    const infractions = await prisma.infraction.findMany({
      where: {
        guild_id,
        target_id: target.id,
        flag: filter ?? undefined
      },
      skip: skipMultiplier * INFRACTIONS_PER_PAGE,
      take: INFRACTIONS_PER_PAGE,
      orderBy: {
        created_at: 'desc'
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
        controller_id
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

  public static async getInfractionInfo(data: { id: string; guild_id: Snowflake }): Promise<InteractionReplyData> {
    const { id, guild_id } = data;

    const infraction = await InfractionManager.getInfraction({ id, guild_id });

    if (!infraction) {
      return {
        error: MessageKeys.Errors.InfractionNotFound(id),
        temporary: true
      };
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${infraction.flag ? `${infraction.flag} ` : ''}${infraction.type} - ID #${infraction.id}` })
      .setColor(InfractionManager.mapActionToColor({ infraction }))
      .setFields([
        { name: 'Executor', value: userMentionWithId(infraction.executor_id) },
        { name: 'Target', value: userMentionWithId(infraction.target_id) },
        { name: 'Reason', value: infraction.reason }
      ])
      .setTimestamp(Number(infraction.created_at));

    if (infraction.expires_at) {
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager.formatExpiration(infraction.expires_at)
      });
    }

    if (infraction.request_author_id) {
      embed.spliceFields(1, 0, { name: 'Requested By', value: userMentionWithId(infraction.request_author_id) });
    }

    if (infraction.request_id) {
      embed.setFooter({ text: `Request ID: #${infraction.request_author_id}` });
    }

    return { embeds: [embed], ephemeral: true };
  }

  /**
   * Delete an infraction that was issued.
   *
   * @param data.guild The guild where the infraction was issued
   * @param data.config The guild configuration
   * @param data.executor The executor of the deletion
   * @param data.infractionId The ID of the infraction to delete
   * @param data.undoPunishment Whether to undo the punishment related to the infraction
   * @param data.notifyReceiver Whether to notify the receiver of the infraction deletion
   * @param data.reason The reason for the deletion
   * @returns The result of the deletion
   */

  public static async deleteReceivedInfraction(data: {
    guild: Guild;
    config: GuildConfig;
    executor: GuildMember;
    infractionId: Snowflake;
    undoPunishment: boolean;
    notifyReceiver: boolean;
    reason: string;
  }): Promise<InteractionReplyData> {
    const { guild, config, executor, infractionId, undoPunishment, notifyReceiver, reason } = data;

    const infraction = await InfractionManager.getInfraction({ id: infractionId, guild_id: guild.id });

    if (!infraction) {
      return {
        error: MessageKeys.Errors.InfractionNotFound(infractionId),
        temporary: true
      };
    }

    const target = await guild.members.fetch(infraction.target_id).catch(() => null);

    let failedUndo = false;

    if (undoPunishment && (infraction.type === 'Mute' || infraction.type === 'Ban')) {
      const permissions = guild.members.me!.permissions;
      const mutePermission = permissions.has('ModerateMembers');
      const banPermission = permissions.has('BanMembers');

      switch (infraction.type) {
        case InfractionType.Mute: {
          if (!target) {
            return {
              error: `I cannot undo the mute for ${userMention(
                infraction.target_id
              )} as they are no longer in the server.`,
              temporary: true
            };
          }

          if (!mutePermission) {
            return {
              error: `I cannot undo the mute for ${target} as I do not have the \`Timeout Members\` permission.`,
              temporary: true
            };
          }

          if (!hierarchyCheck(guild.members.me!, target)) {
            return {
              error: `I cannot undo the mute for ${target} as they have higher or equal roles than me.`,
              temporary: true
            };
          }

          await target
            .timeout(null, `Infraction ${infraction.id} deleted by @${executor.user.username} (${executor.id})`)
            .catch(() => {
              failedUndo = true;
            });

          break;
        }

        case InfractionType.Ban: {
          if (!banPermission) {
            return {
              error: `I cannot undo the ban for ${userMention(
                infraction.target_id
              )} as I do not have the \`Ban Members\` permission.`,
              temporary: true
            };
          }

          if (!(await guild.bans.fetch(infraction.target_id).catch(() => null))) {
            return {
              error: `I cannot undo the ban for ${userMention(infraction.target_id)} as they are not banned.`,
              temporary: true
            };
          }

          await guild.members
            .unban(
              infraction.target_id,
              `Infraction ${infraction.id} deleted by @${executor.user.username} (${executor.id})`
            )
            .catch(() => {
              failedUndo = true;
            });

          break;
        }
      }

      const newInfraction = await InfractionManager.storeInfraction({
        id: InfractionManager.generateInfractionId(),
        guild_id: guild.id,
        type: infraction.type === 'Mute' ? 'Unmute' : 'Unban',
        target_id: infraction.target_id,
        executor_id: executor.id,
        reason: `Original infraction \`#${infraction.id}\` deleted by @${executor.user.username} (${executor.id}).`,
        expires_at: null,
        created_at: Date.now()
      });

      InfractionManager.logInfraction({ config, infraction: newInfraction });
    }

    await InfractionManager.deleteInfraction({ id: infractionId, guild_id: guild.id }).catch(() => null);
    await TaskManager.deleteTask({
      target_id_guild_id_type: {
        target_id: infraction.target_id,
        guild_id: guild.id,
        type: infraction.type === 'Mute' ? 'Mute' : 'Ban'
      }
    });

    if (notifyReceiver && target) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
        .setTitle('Infraction Removed')
        .setFields([
          { name: 'Moderator Reason', value: reason },
          {
            name: 'Infraction Details',
            value: `ID: \`#n${infraction.id}\n\`Type: \`${infraction.type}\`\nDate: ${time(
              Math.floor(Number(infraction.created_at)) / 1000
            )}`
          }
        ])
        .setTimestamp();

      await target.send({ embeds: [embed] }).catch(() => null);
    }

    return {
      content: `${infraction.type} with ID \`#${infractionId}\` for ${userMention(
        infraction.target_id
      )} has been deleted${
        undoPunishment && (infraction.type === 'Mute' || infraction.type === 'Ban')
          ? failedUndo
            ? ` but I was unable to ${infraction.type === 'Mute' ? 'unmute the member' : 'unban the user'}`
            : ` and the ${
                infraction.type === 'Mute' ? 'member was successfully unmuted' : 'user was successfully unbanned'
              }`
          : ``
      }.`
    };
  }

  /**
   * Generate a unique infraction ID based on discord's snowflake.
   * @returns The generated infraction ID.
   */

  public static generateInfractionId(): string {
    return generateSnowflakeId();
  }

  /**
   * Format the fields for infraction search.
   *
   * @param infractions The infractions the user has received
   * @returns The formatted fields
   */

  private static async _getSearchFields(infractions: Infraction[]) {
    let fields: EmbedField[] = [];

    for (const infraction of infractions) {
      const executor = await client.users.fetch(infraction.executor_id).catch(() => null);

      fields.push({
        name: `${infraction.type} #${infraction.id}, by ${
          executor ? `@${executor.username} (${executor.id})` : 'an unknown user'
        }`,
        value: `${elipsify(infraction.reason, 256)} - ${time(Math.floor(Number(infraction.created_at) / 1000))}`,
        inline: false
      });
    }

    return fields;
  }

  /**
   * Get the pagination buttons for infraction search embed.
   *
   * @param data.page The current page
   * @param data.totalPages The total number of pages
   * @param data.controllerId Id of the user who initiated the search
   * @returns The pagination buttons
   */

  private static _getPaginationButtons(data: { page: number; totalPages: number; controller_id: Snowflake }) {
    const { page, totalPages, controller_id } = data;

    const isFirstPage = page === 1;
    const isLastPage = page === totalPages;

    const pageCountButton = new ButtonBuilder()
      .setLabel(`${page} / ${totalPages}`)
      .setDisabled(true)
      .setStyle(ButtonStyle.Secondary);

    const nextButton = new ButtonBuilder()
      .setLabel('→')
      .setCustomId(`infraction-search-next-${controller_id}`)
      .setDisabled(isLastPage)
      .setStyle(ButtonStyle.Primary);

    const previousButton = new ButtonBuilder()
      .setLabel('←')
      .setCustomId(`infraction-search-back-${controller_id}`)
      .setDisabled(isFirstPage)
      .setStyle(ButtonStyle.Primary);

    if (totalPages > 2) {
      const firstPageButton = new ButtonBuilder()
        .setLabel('«')
        .setCustomId(`infraction-search-first-${controller_id}`)
        .setDisabled(isFirstPage)
        .setStyle(ButtonStyle.Primary);

      const lastPageButton = new ButtonBuilder()
        .setLabel('»')
        .setCustomId(`infraction-search-last-${controller_id}`)
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

  /**
   * Format an audit log reason for an infraction.
   *
   * @param executor The executor of the action
   * @param punishment The type of punishment
   * @param reason The reason for the action
   * @returns The formatted reason
   */

  private static formatAuditLogReason(
    executor: GuildMember,
    punishment: Exclude<InfractionType, 'Warn'>,
    reason: string
  ): string {
    return `${capitalize(InfractionManager.getPastTense(punishment))} by @${executor.user.username} (${
      executor.id
    }) - ${reason}`;
  }

  /**
   * Get the preposition for an infraction type.
   *
   * @param type The infraction type
   * @returns The preposition
   */

  private static getPreposition(type: InfractionType): string {
    return type === 'Ban' || type === 'Unban' ? 'from' : 'in';
  }

  /**
   * Get the past tense for an infraction type.
   *
   * @param type The infraction type
   * @returns The past tense
   */

  private static getPastTense(type: InfractionType): string {
    return PAST_TENSE_INFRACTIONS[type.toLowerCase() as keyof typeof PAST_TENSE_INFRACTIONS];
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
