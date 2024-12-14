import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import ms from 'ms';

import { InteractionReplyData, GuildConfig } from '@utils/Types';
import { MaxDurationStr } from '@utils/Constants';
import { isEphemeralReply, parseDuration } from '@utils/index';
import { MessageKeys, DurationKeys } from '@utils/Keys';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager, { DefaultInfractionReason } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';

export default class Ban extends Command {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      requiredPermissions: PermissionFlagsBits.BanMembers,
      usage: '<target> [duration] [reason] [delete_previous_messages]',
      data: {
        name: 'ban',
        description: 'Ban a member or user from the server.',
        type: ApplicationCommandType.ChatInput,
        defaultMemberPermissions: PermissionFlagsBits.BanMembers,
        options: [
          {
            name: 'target',
            description: 'The member or user to ban.',
            type: ApplicationCommandOptionType.User,
            required: true
          },
          {
            name: 'duration',
            description: 'The duration of the ban.',
            type: ApplicationCommandOptionType.String,
            required: false,
            autocomplete: true
          },
          {
            name: 'reason',
            description: 'The reason for banning the target.',
            type: ApplicationCommandOptionType.String,
            required: false,
            max_length: 1024
          },
          {
            name: 'delete_previous_messages',
            description: 'The amount of days to delete previous messages for.',
            type: ApplicationCommandOptionType.String,
            choices: [
              { name: 'Previous hour', value: '1h' },
              { name: 'Previous 6 hours', value: '6h' },
              { name: 'Previous 12 hours', value: '12h' },
              { name: 'Previous 24 hours', value: '24h' },
              { name: 'Previous 3 days', value: '3d' },
              { name: 'Previous 7 days', value: '7d' }
            ],
            required: false
          }
        ]
      }
    });
  }

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData> {
    const member = interaction.options.getMember('target');
    const rawDuration = interaction.options.getString('duration', false);
    const rawReason = interaction.options.getString('reason', false);
    const rawDeleteMessages = interaction.options.getString('delete_previous_messages', false);

    const target = member?.user ?? interaction.options.getUser('target');

    if (!target) {
      return {
        error: MessageKeys.Errors.InvalidTarget,
        temporary: true
      };
    }

    const vResult = InfractionManager.validateAction({
      config,
      guild: interaction.guild,
      target: member ?? target,
      executor: interaction.member,
      action: 'Ban',
      reason: rawReason
    });

    if (!vResult.success) {
      return {
        error: vResult.message,
        temporary: true
      };
    }

    const duration = rawDuration ? parseDuration(rawDuration) : null;

    if (Number.isNaN(duration) && !DurationKeys.Permanent.includes(rawDuration?.toLowerCase() ?? '')) {
      return {
        error: MessageKeys.Errors.InvalidDuration(true),
        temporary: true
      };
    }

    if (duration) {
      if (duration < 1000) {
        return {
          error: MessageKeys.Errors.DurationTooShort('1 second'),
          temporary: true
        };
      }

      if (duration > ms(MaxDurationStr)) {
        return {
          error: MessageKeys.Errors.DurationTooLong('1 year'),
          temporary: true
        };
      }
    }

    const deleteMessageSeconds = Math.floor(ms(rawDeleteMessages ?? '0s') / 1000);
    const reason = rawReason ?? DefaultInfractionReason;

    await interaction.deferReply({ ephemeral: isEphemeralReply(interaction, config) });

    const createdAt = Date.now();
    const expiresAt = duration
      ? createdAt + duration
      : !DurationKeys.Permanent.includes(rawDuration?.toLowerCase() ?? '') && config.default_ban_duration !== 0n
      ? createdAt + Number(config.default_ban_duration)
      : null;

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guild_id: interaction.guildId,
      target_id: target.id,
      executor_id: interaction.user.id,
      type: 'Ban',
      reason,
      created_at: createdAt,
      expires_at: expiresAt
    });

    if (member) {
      await InfractionManager.sendNotificationDM({ config, guild: interaction.guild, target: member, infraction });
    }

    const ban = await InfractionManager.resolvePunishment({
      guild: interaction.guild,
      target,
      executor: interaction.member,
      action: 'Ban',
      reason,
      deleteMessages: deleteMessageSeconds
    });

    if (!ban.success) {
      await InfractionManager.deleteInfraction({ id: infraction.id });

      return {
        error: MessageKeys.Errors.PunishmentFailed('Ban', target),
        temporary: true
      };
    }

    const promises: any[] = [InfractionManager.logInfraction({ config, infraction })];

    if (expiresAt) {
      promises.push(
        TaskManager.storeTask({
          guild_id: interaction.guildId,
          target_id: target.id,
          infraction_id: infraction.id,
          expires_at: expiresAt,
          type: 'Ban'
        })
      );
    } else {
      promises.push(
        TaskManager.deleteTask({
          target_id_guild_id_type: { guild_id: interaction.guildId, target_id: target.id, type: 'Ban' }
        })
      );
    }

    await Promise.all(promises);

    return {
      embeds: [
        {
          description: InfractionManager.getSuccessMessage({ target, infraction }),
          color: InfractionManager.mapActionToColor({ infraction })
        }
      ]
    };
  }
}
