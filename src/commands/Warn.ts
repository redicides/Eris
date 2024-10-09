import { Guild as Config } from '@prisma/client';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import ms from 'ms';

import { parseDuration } from '@utils/index';
import { PERMANENT_DURATION_KEYS } from '@utils/Constants';
import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@/managers/commands/Command';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@/managers/database/InfractionManager';

export default class Warn extends Command<ChatInputCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      data: {
        name: 'warn',
        description: 'Issue a warning to a member.',
        type: ApplicationCommandType.ChatInput,
        defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
        options: [
          {
            name: 'target',
            description: 'The member to warn.',
            type: ApplicationCommandOptionType.User,
            required: true
          },
          {
            name: 'duration',
            description: 'How long the warning should be valid for.',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'reason',
            description: 'The reason for warning the target.',
            type: ApplicationCommandOptionType.String,
            required: false,
            max_length: 1000
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>, config: Config): Promise<InteractionReplyData> {
    const target = interaction.options.getMember('target');
    const rawDuration = interaction.options.getString('duration', false);
    const rawReason = interaction.options.getString('reason', false);

    if (!target) {
      return {
        error: 'The provided user is not a member of this server.',
        temporary: true
      };
    }

    const vResult = await InfractionManager.validateAction({
      guild: interaction.guild,
      target,
      executor: interaction.member!,
      action: 'Warn'
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

    const createdAt = Date.now();
    const expiresAt = duration ? createdAt + duration : null;
    const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

    await interaction.deferReply({ ephemeral: true });

    const infraction = await InfractionManager.storeInfraction({
      guildId: interaction.guildId,
      targetId: target.id,
      executorId: interaction.user.id,
      type: 'Warn',
      reason,
      createdAt,
      expiresAt
    });

    InfractionManager.sendNotificationDM({ guild: interaction.guild, config, target, infraction });
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
