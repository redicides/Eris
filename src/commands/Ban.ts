import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import ms from 'ms';

import { PERMANENT_DURATION_KEYS } from '@utils/Constants';
import { InteractionReplyData, GuildConfig } from '@utils/Types';
import { parseDuration } from '@utils/index';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';

export default class Ban extends Command<ChatInputCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      requiredPermissions: PermissionFlagsBits.BanMembers,
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
            required: false
          },
          {
            name: 'reason',
            description: 'The reason for banning the target.',
            type: ApplicationCommandOptionType.String,
            required: false,
            max_length: 1000
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
        error: 'The provided target is invalid.',
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

    if (Number.isNaN(duration) && !PERMANENT_DURATION_KEYS.includes(rawDuration?.toLowerCase() ?? '')) {
      return {
        error: 'Invalid duration. The valid format is `<number>[s/m/h/d]` (`<number> [second/minute/hour/day]`).',
        temporary: true
      };
    }

    if (duration) {
      if (duration < 1000) {
        return {
          error: 'The duration must be at least 1 second.',
          temporary: true
        };
      }

      if (duration > ms('365d')) {
        return {
          error: 'The duration must not exceed 1 year.',
          temporary: true
        };
      }
    }

    const deleteMessageSeconds = Math.floor(ms(rawDeleteMessages ?? '0s') / 1000);

    let expiresAt: number | null = null;

    const createdAt = Date.now();
    const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

    if (duration) {
      expiresAt = createdAt + duration;
    } else if (
      !PERMANENT_DURATION_KEYS.includes(rawDuration?.toLowerCase() ?? '') &&
      config.defaultBanDuration !== 0n
    ) {
      expiresAt = createdAt + Number(config.defaultBanDuration);
    }

    await interaction.deferReply({ ephemeral: true });

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
      await InfractionManager.deleteInfraction({ where: { id: infraction.id } });
      return {
        error: `Failed to ban ${target}. The related infraction has been deleted.`,
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
        where: { targetId_guildId_type: { guildId: interaction.guildId, targetId: target.id, type: 'Ban' } }
      }).catch(() => null);
    }

    InfractionManager.logInfraction({ config, infraction });

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
