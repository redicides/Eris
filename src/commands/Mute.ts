import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import ms from 'ms';

import { InteractionReplyData } from '@/utils/types';
import { parseDuration } from '@/utils';

import Command, { CommandCategory } from '@/managers/commands/Command';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@/managers/database/InfractionManager';

export default class Mute extends Command<ChatInputCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      requiredPermissions: PermissionFlagsBits.ModerateMembers,
      data: {
        name: 'mute',
        description: 'Mute a member in the server.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'member',
            description: 'The member to mute.',
            type: ApplicationCommandOptionType.User,
            required: true
          },
          {
            name: 'duration',
            description: 'The duration of the mute.',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'reason',
            description: 'The reason for the mute.',
            type: ApplicationCommandOptionType.String,
            required: false
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const config = await this.prisma.guild.findUnique({ where: { id: interaction.guildId } });

    const target = interaction.options.getMember('member');
    const rawDuration = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason', false);

    if (!target) {
      return {
        error: 'The provided user is not a member of this server.',
        temporary: true
      };
    }

    const result = await InfractionManager.validateAction({
      guild: interaction.guild,
      target,
      executor: interaction.member!,
      action: 'Mute'
    });

    if (!result.success) {
      return {
        error: result.message,
        temporary: true
      };
    }

    const duration = parseDuration(rawDuration);

    if (!duration) {
      return {
        error: 'Invalid duration. The valid format is `<number>[s/m/h/d]` (`<number> [second/minute/hour/day]`).',
        temporary: true
      };
    }

    if (duration < 1000) {
      return {
        error: 'The duration must be at least 1 second.',
        temporary: true
      };
    }

    if (duration > ms('28d')) {
      return {
        error: 'The duration cannot be longer than 28 days.',
        temporary: true
      };
    }

    const createdAt = Date.now();
    const expiresAt = createdAt + duration;

    await interaction.deferReply({ ephemeral: true });

    const infraction = await InfractionManager.storeInfraction({
      guildId: interaction.guildId,
      targetId: target.id,
      executorId: interaction.user.id,
      type: 'Mute',
      createdAt,
      expiresAt,
      reason: reason ?? DEFAULT_INFRACTION_REASON
    });

    await InfractionManager.resolvePunishment({
      guild: interaction.guild,
      executor: interaction.member!,
      target,
      action: 'Mute',
      reason: reason ?? DEFAULT_INFRACTION_REASON,
      duration: expiresAt
    }).catch(async () => {
      await InfractionManager.deleteInfraction({ where: { id: infraction.id } });
      return {
        error: 'Failed to mute the member. As a result, the related infraction has been deleted.',
        temporary: true
      };
    });

    InfractionManager.logInfraction({ config: config!, infraction });

    return { content: `Successfully muted ${target} for **${ms(duration, { long: true })}** - \`#${infraction.id}\`` };
  }
}
