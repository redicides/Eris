import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import ms from 'ms';

import { InteractionReplyData, GuildConfig } from '@utils/Types';
import { MAX_DURATION_STR } from '@utils/Constants';
import { isEphemeralReply, parseDuration } from '@utils/index';
import { MessageKeys, DurationKeys } from '@utils/Keys';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';
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

      if (duration > ms(MAX_DURATION_STR)) {
        return {
          error: MessageKeys.Errors.DurationTooLong('1 year'),
          temporary: true
        };
      }
    }

    const deleteMessageSeconds = Math.floor(ms(rawDeleteMessages ?? '0s') / 1000);
    const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

    let expiresAt: number | null = null;

    await interaction.deferReply({ ephemeral: isEphemeralReply({ interaction, config }) });

    const createdAt = Date.now();

    if (duration) {
      expiresAt = createdAt + duration;
    } else if (!DurationKeys.Permanent.includes(rawDuration?.toLowerCase() ?? '') && config.defaultBanDuration !== 0n) {
      expiresAt = createdAt + Number(config.defaultBanDuration);
    }

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guildId: interaction.guildId,
      targetId: target.id,
      executorId: interaction.user.id,
      type: 'Ban',
      reason,
      createdAt,
      expiresAt
    });

    let bResult = true;

    if (member) {
      await InfractionManager.sendNotificationDM({ config, guild: interaction.guild, target: member, infraction });
    }

    await InfractionManager.resolvePunishment({
      guild: interaction.guild,
      executor: interaction.member,
      target,
      action: 'Ban',
      reason,
      duration: null,
      deleteMessages: deleteMessageSeconds
    }).catch(() => {
      bResult = false;
    });

    if (!bResult) {
      await InfractionManager.deleteInfraction({ id: infraction.id });
      return {
        error: MessageKeys.Errors.PunishmentFailed('Ban', target),
        temporary: true
      };
    }

    if (expiresAt) {
      await TaskManager.storeTask({
        guildId: interaction.guildId,
        targetId: target.id,
        infractionId: infraction.id,
        expiresAt,
        type: 'Ban'
      });
    } else {
      await TaskManager.deleteTask({
        targetId_guildId_type: { guildId: interaction.guildId, targetId: target.id, type: 'Ban' }
      });
    }

    await InfractionManager.logInfraction({ config, infraction });

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
