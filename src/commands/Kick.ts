import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';
import { Guild as Config } from '@prisma/client';

import { InteractionReplyData } from '@/utils/types';

import Command, { CommandCategory } from '@/managers/commands/Command';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@/managers/database/InfractionManager';

export default class Kick extends Command<ChatInputCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      requiredPermissions: PermissionFlagsBits.KickMembers,
      data: {
        name: 'kick',
        description: 'Kick a member from the server.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'target',
            description: 'The member to kick.',
            type: ApplicationCommandOptionType.User,
            required: true
          },
          {
            name: 'reason',
            description: 'The reason for kicking the target.',
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
      action: 'Kick'
    });

    if (!vResult.success) {
      return {
        error: vResult.message,
        temporary: true
      };
    }

    const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

    await interaction.deferReply({ ephemeral: true });

    let kResult = true;

    const infraction = await InfractionManager.storeInfraction({
      guildId: interaction.guildId,
      targetId: target.id,
      executorId: interaction.user.id,
      type: 'Kick',
      reason,
      createdAt: Date.now()
    });

    await InfractionManager.sendNotificationDM({ guild: interaction.guild, config, target, infraction });

    await InfractionManager.resolvePunishment({
      guild: interaction.guild,
      executor: interaction.member!,
      target,
      action: 'Kick',
      reason,
      duration: null
    }).catch(() => {
      kResult = false;
    });

    if (!kResult) {
      await InfractionManager.deleteInfraction({ where: { id: infraction.id } });
      return {
        error: `Failed to kick ${target}. The related infraction has been deleted.`,
        temporary: true
      };
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