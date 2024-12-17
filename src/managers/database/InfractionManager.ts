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
  userMention,
  PermissionFlagsBits
} from 'discord.js';
import { Infraction, InfractionFlag, InfractionType, Prisma } from '@prisma/client';

import { DurationKeys, MessageKeys } from '@utils/Keys';
import { client, prisma } from '@/index';
import {
  capitalize,
  elipsify,
  generateSnowflakeId,
  hierarchyCheck,
  parseDuration,
  uploadData,
  userMentionWithId
} from '@utils/index';
import { GuildConfig, InteractionReplyData, Result } from '@utils/Types';
import { LogDateFormat } from '@utils/Constants';

import TaskManager from './TaskManager';
import ms from 'ms';

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

  static async getActiveMute(options: { guildId: Snowflake; targetId: Snowflake }): Promise<Infraction | null> {
    return prisma.infraction.findFirst({
      where: {
        guild_id: options.guildId,
        target_id: options.targetId,
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

  static async logInfraction(config: GuildConfig, infraction: Infraction): Promise<APIMessage | null> {
    if (!config.infraction_logging_enabled || !config.infraction_logging_webhook) return null;

    const webhook = new WebhookClient({ url: config.infraction_logging_webhook });

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${infraction.flag ? `${infraction.flag} ` : ''}${infraction.type} - ID #${infraction.id}`
      })
      .setColor(InfractionColors[infraction.type])
      .setFields([
        { name: 'Executor', value: userMentionWithId(infraction.executor_id) },
        { name: 'Target', value: userMentionWithId(infraction.target_id) },
        { name: 'Reason', value: infraction.reason }
      ])
      .setTimestamp(Number(infraction.created_at));

    if (infraction.expires_at) {
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager._formatExpiration(infraction.expires_at, ExpirationFormatStyle.RelativeAndAbsolute)
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
      .setColor(InfractionColors[infraction.type])
      .setTitle(
        `You've been ${InfractionManager._getPastTense(infraction.type)} ${InfractionManager._getPreposition(
          infraction.type
        )} ${guild.name}`
      )
      .setFields([{ name: 'Reason', value: infraction.reason }])
      .setFooter({ text: `Infraction ID: ${infraction.id}` })
      .setTimestamp(Number(infraction.created_at));

    if (infraction.expires_at) {
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager._formatExpiration(infraction.expires_at, ExpirationFormatStyle.RelativeAndAbsolute)
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
   * @param data The punishment data
   * @returns The result of the action
   */

  public static async resolvePunishment<T extends Exclude<InfractionType, 'Warn'>>(
    data: PunishmentData<T>
  ): Promise<Result> {
    const { guild, executor, target, action, reason } = data;

    try {
      switch (action) {
        case 'Mute':
          await (target as GuildMember).timeout(
            (data as PunishmentData<'Mute'>).duration,
            InfractionManager._formatAuditLogReason(executor, action, reason)
          );
          break;

        case 'Kick':
          await guild.members.kick(target.id, InfractionManager._formatAuditLogReason(executor, action, reason));
          break;

        case 'Ban':
          await guild.members.ban(target.id, {
            reason: InfractionManager._formatAuditLogReason(executor, action, reason),
            deleteMessageSeconds: (data as PunishmentData<'Ban'>).deleteMessages
          });
          break;

        case 'Unban':
          await guild.members.unban(target.id, InfractionManager._formatAuditLogReason(executor, action, reason));
          break;

        case 'Unmute':
          await (target as GuildMember).timeout(
            null,
            InfractionManager._formatAuditLogReason(executor, action, reason)
          );
          break;
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: `Failed to ${action.toLowerCase()} ${target}: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get the success message when issuing an infraction.
   *
   * @param data.target The target user
   * @param data.infraction The issued infraction
   * @returns The success message
   */

  public static getSuccessMessage(infraction: Infraction, target: User | GuildMember): string {
    const { type, id, expires_at } = infraction;

    const relativeTimestamp = InfractionManager._formatExpiration(expires_at, ExpirationFormatStyle.Relative);
    const timestamp = InfractionManager._formatExpiration(expires_at, ExpirationFormatStyle.Absolute);

    const message: Record<InfractionType, string> = {
      Warn: `Successfully added a warning for ${target}${expires_at ? ` that will expire ${relativeTimestamp}` : ''}`,
      Mute: `Successfully set ${target} on a timeout that will end ${relativeTimestamp}`,
      Kick: `Successfully kicked ${target}`,
      Ban: `Successfully banned ${target}${expires_at ? ` until ${timestamp}` : ''}`,
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

  public static mapActionToColor(type: InfractionType): number {
    return InfractionColors[type];
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
        guild_id: guildId,
        target_id: target.id,
        flag: filter ?? undefined
      }
    });

    const infractions = await prisma.infraction.findMany({
      where: {
        guild_id: guildId,
        target_id: target.id,
        flag: filter ?? undefined
      },
      skip: skipMultiplier * InfractionsPerPage,
      take: InfractionsPerPage,
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

    if (infractionCount > InfractionsPerPage) {
      const totalPages = Math.ceil(infractionCount / InfractionsPerPage);
      const paginationActionRow = InfractionManager._getPaginationButtons(page, totalPages, controllerId);

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
      .setColor(InfractionManager.mapActionToColor(infraction.type))
      .setFields([
        { name: 'Executor', value: userMentionWithId(infraction.executor_id) },
        { name: 'Target', value: userMentionWithId(infraction.target_id) },
        { name: 'Reason', value: infraction.reason }
      ])
      .setTimestamp(Number(infraction.created_at));

    if (infraction.expires_at) {
      embed.addFields({
        name: 'Expiration',
        value: InfractionManager._formatExpiration(infraction.expires_at, ExpirationFormatStyle.RelativeAndAbsolute)
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

      InfractionManager.logInfraction(config, newInfraction);
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
        .setTitle(`${infraction.type} Infraction Removed`)
        .setFields([{ name: 'Moderator Reason', value: reason }])
        .setFooter({ text: `Infraction ID: ${infraction.id}` })
        .setTimestamp();

      await target.send({ embeds: [embed] }).catch(() => null);
    }

    await InfractionManager._logInfractionDeletion({ infraction, executor, reason, config });

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
   * Edit the reason for an infraction.
   *
   * @param data.infraction_id The ID of the infraction to edit
   * @param data.new_reason The new reason for the infraction
   * @param data.notify_receiver Whether to notify the receiver of the infraction
   * @param data.guild The guild where the infraction was issued
   * @returns The result of the edit
   */

  public static async editInfractionReason(data: {
    id: Snowflake;
    newReason: string;
    notifyReceiver: boolean;
    guild: Guild;
    executor: GuildMember;
    config: GuildConfig;
  }): Promise<InteractionReplyData> {
    const { id, newReason, notifyReceiver, executor, config, guild } = data;

    const infraction = await InfractionManager.getInfraction({ id, guild_id: guild.id });

    if (!infraction) {
      return {
        error: MessageKeys.Errors.InfractionNotFound(id),
        temporary: true
      };
    }

    if (infraction.reason === newReason) {
      return {
        error: 'The new cannot be the same as the old reason.',
        temporary: true
      };
    }

    await prisma.infraction.update({
      where: { id },
      data: { reason: newReason }
    });

    if (notifyReceiver) {
      const target = await guild.members.fetch(infraction.target_id).catch(() => null);

      if (target) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
          .setTitle(`${infraction.type} Reason Updated`)
          .setFields([
            { name: 'Old Reason', value: elipsify(infraction.reason, 256) },
            { name: 'New Reason', value: elipsify(newReason, 256) }
          ])
          .setFooter({ text: `Infraction ID: ${infraction.id}` })
          .setTimestamp();

        await target.send({ embeds: [embed] }).catch(() => null);
      }
    }

    await InfractionManager._logInfractionReasonEdit({ infraction, executor, newReason, config });

    return {
      content: `Successfully updated the reason of ${infraction.type.toLowerCase()} infraction with ID \`#${
        infraction.id
      }\`.`
    };
  }

  /**
   * Edit the duration of an infraction.
   *
   * @param data.infraction_id The ID of the infraction to edit
   * @param data.raw_duration The new duration for the infraction
   * @param data.edit_reason The reason for editing the duration
   * @param data.notify_receiver Whether to notify the receiver of the infraction
   * @param data.guild The guild where the infraction was issued
   * @returns The result of the edit
   */

  public static async editInfractionDuration(data: {
    id: Snowflake;
    rawDuration: string;
    editReason: string;
    notifyReceiver: boolean;
    guild: Guild;
    executor: GuildMember;
    config: GuildConfig;
  }): Promise<InteractionReplyData> {
    const { id, rawDuration, editReason, notifyReceiver, guild, executor, config } = data;

    const currentDate = Date.now();
    const infraction = await InfractionManager.getInfraction({ id, guild_id: guild.id });

    if (!infraction) {
      return {
        error: MessageKeys.Errors.InfractionNotFound(id),
        temporary: true
      };
    }

    if (infraction.type === 'Unban' || infraction.type === 'Unmute' || infraction.type === 'Kick') {
      return {
        error: `You cannot edit the duration of ${infraction.type.toLowerCase()} infractions.`,
        temporary: true
      };
    }

    if (infraction.expires_at !== null && infraction.expires_at < currentDate) {
      return {
        error: `The infraction with ID \`${id}\` has already expired.`,
        temporary: true
      };
    }

    const targetMember = await guild.members.fetch(infraction.target_id).catch(() => null);
    const duration = DurationKeys.Permanent.includes(rawDuration.toLowerCase()) ? 0 : parseDuration(rawDuration);

    if (Number.isNaN(duration) || (duration !== 0 && duration < 1000)) {
      return {
        error: duration === 0 ? MessageKeys.Errors.InvalidDuration() : 'The new duration must be at least 1 second.',
        temporary: true
      };
    }

    if (infraction.type === 'Mute') {
      if (!guild.members.me!.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return {
          error: 'I do not have the `Timeout Members` permission which is required to edit the duration of mutes.',
          temporary: true
        };
      }

      if (duration > ms('28d') || duration === 0) {
        return {
          error: 'The new duration for mutes must be between 1 second and 28 days.',
          temporary: true
        };
      }

      if (!targetMember || !hierarchyCheck(guild.members.me!, targetMember)) {
        return {
          error: !targetMember
            ? 'I cannot edit the duration of the mute as the target member is no longer in the server.'
            : 'I cannot edit the duration of the mute as the target member has higher or equal roles than me.',
          temporary: true
        };
      }

      await targetMember.timeout(
        duration,
        `Infraction ${infraction.id} edited by @${executor.user.username} (${executor.id}) - ${editReason}`
      );
    }

    const newExpiration = duration ? currentDate + duration : null;

    await prisma.infraction.update({
      where: { id },
      data: { expires_at: newExpiration }
    });

    if (infraction.type !== 'Warn') {
      if (newExpiration) {
        await TaskManager.storeTask({
          guild_id: guild.id,
          target_id: infraction.target_id,
          infraction_id: infraction.id,
          expires_at: newExpiration,
          type: infraction.type
        });
      } else {
        await TaskManager.deleteTask({
          target_id_guild_id_type: {
            target_id: infraction.target_id,
            guild_id: guild.id,
            type: infraction.type
          }
        });
      }
    }

    if (targetMember && notifyReceiver) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
        .setTitle(`${infraction.type} Duration Updated`)
        .setFields([
          {
            name: 'New Expiration',
            value: InfractionManager._formatExpiration(newExpiration, ExpirationFormatStyle.RelativeAndAbsolute)
          },
          { name: 'Moderator Reason', value: editReason }
        ])
        .setFooter({ text: `Infraction ID: ${infraction.id}` })
        .setTimestamp();

      await targetMember.send({ embeds: [embed] }).catch(() => null);
    }

    await InfractionManager._logInfractionDurationEdit({
      infraction,
      executor,
      newExpiration,
      editReason,
      config
    });

    return {
      content: `Successfully updated the duration of ${infraction.type.toLowerCase()} infraction with ID \`#${
        infraction.id
      }\`. ${
        newExpiration
          ? `It will now expire on ${InfractionManager._formatExpiration(
              newExpiration,
              ExpirationFormatStyle.RelativeAndAbsolute
            )}.`
          : 'It is now permanent'
      }.`
    };
  }

  /**
   * Log the deletion of an infraction.
   *
   * @param data.infraction The infraction that was deleted
   * @param data.executor The executor of the deletion
   * @param data.reason The reason for the deletion
   * @param data.config The guild configuration
   * @returns The sent message, if successful
   */

  private static async _logInfractionDeletion(data: {
    infraction: Infraction;
    executor: GuildMember;
    reason: string;
    config: GuildConfig;
  }): Promise<APIMessage | null> {
    const { infraction, executor, reason, config } = data;

    if (!config.infraction_logging_enabled || !config.infraction_logging_webhook) return null;

    const infractionData = InfractionManager._parseInfractionData(infraction);

    const dataUrl = await uploadData(infractionData, 'txt');
    const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Infraction Data').setURL(dataUrl);
    const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(button);

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${infraction.type} Deleted - ID #${infraction.id}` })
      .setColor(Colors.Red)
      .setFields([
        {
          name: 'Executor',
          value: userMentionWithId(executor.id)
        },
        {
          name: 'Reason',
          value: reason
        }
      ])
      .setTimestamp();

    return new WebhookClient({ url: config.infraction_logging_webhook })
      .send({ embeds: [embed], components: [actionRow] })
      .catch(() => null);
  }

  /**
   * Log an infraction duration edit.
   *
   * @param data.infraction The infraction that was edited
   * @param data.executor The executor of the edit
   * @param data.new_expiration The new expiration date
   * @param data.edit_reason The reason for the edit
   * @param data.config The guild configuration
   * @returns The sent message, if successful
   */

  private static async _logInfractionDurationEdit(data: {
    infraction: Infraction;
    executor: GuildMember;
    newExpiration: number | bigint | null;
    editReason: string;
    config: GuildConfig;
  }) {
    const { infraction, executor, newExpiration, editReason, config } = data;

    if (!config.infraction_logging_enabled || !config.infraction_logging_webhook) return null;

    const expiration = InfractionManager._formatExpiration(newExpiration, ExpirationFormatStyle.RelativeAndAbsolute);
    const oldExpiration = InfractionManager._formatExpiration(
      infraction.expires_at,
      ExpirationFormatStyle.RelativeAndAbsolute
    );

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${infraction.type} Updated - ID #${infraction.id}` })
      .setColor(Colors.Blue)
      .setFields([
        {
          name: 'Executor',
          value: userMentionWithId(executor.id)
        },
        {
          name: 'Reason',
          value: editReason
        },
        {
          name: 'Expiration (Before)',
          value: oldExpiration
        },
        {
          name: 'Expiration (After)',
          value: expiration
        }
      ])
      .setTimestamp();

    return new WebhookClient({ url: config.infraction_logging_webhook }).send({ embeds: [embed] }).catch(() => null);
  }

  /**
   * Log an infraction reason edit.
   *
   * @param data.infraction The infraction that was edited
   * @param data.executor The executor of the edit
   * @param data.new_reason The new reason for the infraction
   * @param data.config The guild configuration
   * @returns
   */

  private static async _logInfractionReasonEdit(data: {
    infraction: Infraction;
    executor: GuildMember;
    newReason: string;
    config: GuildConfig;
  }): Promise<APIMessage | null> {
    const { infraction, executor, newReason, config } = data;

    if (!config.infraction_logging_enabled || !config.infraction_logging_webhook) return null;

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${infraction.type} Updated - ID #${infraction.id}` })
      .setColor(Colors.Blue)
      .setFields([
        {
          name: 'Executor',
          value: userMentionWithId(executor.id)
        },
        {
          name: 'Reason (Before)',
          value: infraction.reason
        },
        {
          name: 'Reason (After)',
          value: newReason
        }
      ])
      .setTimestamp();

    return new WebhookClient({ url: config.infraction_logging_webhook }).send({ embeds: [embed] }).catch(() => null);
  }

  /**
   * Generate a unique infraction ID based on discord's snowflake.
   * @returns The generated infraction ID.
   */

  public static generateInfractionId(): string {
    return generateSnowflakeId();
  }

  /**
   * Format an expiration date.
   *
   * @param expiration The expiration date
   * @returns The formatted expiration date
   */

  private static _formatExpiration(expiration: bigint | number | null, style: ExpirationFormatStyle): string {
    switch (style) {
      case ExpirationFormatStyle.Absolute:
        return expiration === null ? 'Never' : time(Math.floor(Number(expiration) / 1000));
      case ExpirationFormatStyle.Relative:
        return expiration === null ? 'Never' : time(Math.floor(Number(expiration) / 1000), 'R');

      case ExpirationFormatStyle.RelativeAndAbsolute:
        return expiration === null
          ? 'Never'
          : `${time(Math.floor(Number(expiration) / 1000))} (${time(Math.floor(Number(expiration) / 1000), 'R')})`;
    }
  }

  /**
   * Parse infraction data for logging.
   *
   * @param infraction The infraction to parse
   * @returns The parsed infraction data, formatted for logging
   */

  private static _parseInfractionData(infraction: Infraction): string {
    const isoDate = new Date(Number(infraction.created_at)).toLocaleString(undefined, LogDateFormat);
    const isoExpiration = infraction.expires_at
      ? new Date(Number(infraction.expires_at)).toLocaleString(undefined, LogDateFormat)
      : 'Never';

    let infractionData = `${infraction.type} #${infraction.id}\n └── Target: ${infraction.target_id}\n └── Executor: ${infraction.executor_id}\n └── Reason: ${infraction.reason}\n └── Created On: ${isoDate}\n └── Expires: ${isoExpiration}`;

    if (infraction.request_id) {
      infractionData += `\n └── Request ID: ${infraction.request_id}`;
    }

    if (infraction.request_author_id) {
      infractionData += `\n └── Requested By: ${infraction.request_author_id}`;
    }

    return infractionData;
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

  private static _getPaginationButtons(page: number, totalPages: number, controllerId: Snowflake) {
    const isFirstPage = page === 1;
    const isLastPage = page === totalPages;

    const pageCountButton = new ButtonBuilder()
      .setLabel(`${page} / ${totalPages}`)
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

  /**
   * Format an audit log reason for an infraction.
   *
   * @param executor The executor of the action
   * @param punishment The type of punishment
   * @param reason The reason for the action
   * @returns The formatted reason
   */

  private static _formatAuditLogReason(
    executor: GuildMember,
    punishment: Exclude<InfractionType, 'Warn'>,
    reason: string
  ): string {
    return `${capitalize(InfractionManager._getPastTense(punishment))} by @${executor.user.username} (${
      executor.id
    }) - ${reason}`;
  }

  /**
   * Get the preposition for an infraction type.
   *
   * @param type The infraction type
   * @returns The preposition
   */

  private static _getPreposition(type: InfractionType): string {
    return type === 'Ban' || type === 'Unban' ? 'from' : 'in';
  }

  /**
   * Get the past tense for an infraction type.
   *
   * @param type The infraction type
   * @returns The past tense
   */

  private static _getPastTense(type: InfractionType): string {
    return PastTenseInfractions[type as keyof typeof PastTenseInfractions];
  }
}

export const InfractionsPerPage = 5;

export const PastTenseInfractions = {
  Ban: 'banned',
  Kick: 'kicked',
  Mute: 'muted',
  Warn: 'warned',
  Unban: 'unbanned',
  Unmute: 'unmuted'
};

export const InfractionColors = {
  Warn: Colors.Yellow,
  Mute: 0xef975c,
  Kick: Colors.Orange,
  Ban: Colors.Red,
  Unmute: Colors.Green,
  Unban: Colors.Green
};

export const DefaultInfractionReason = 'No reason provided.';

type PunishmentData<T extends Exclude<InfractionType, 'Warn'>> = {
  guild: Guild;
  executor: GuildMember;
  target: T extends 'Mute' | 'Unmute' ? GuildMember : User | GuildMember;
  action: T;
  reason: string;
} & (T extends 'Mute' ? { duration: number | null } : T extends 'Ban' ? { deleteMessages?: number } : {});

enum ExpirationFormatStyle {
  Relative = 'R',
  Absolute = 'A',
  RelativeAndAbsolute = 'RA'
}
