import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import { InteractionReplyData, GuildConfig } from '@utils/Types';
import { MessageKeys } from '@utils/Keys';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';

export default class Kick extends Command {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      requiredPermissions: PermissionFlagsBits.KickMembers,
      usage: '<target> [reason]',
      data: {
        name: 'kick',
        description: 'Kick a member from the server.',
        type: ApplicationCommandType.ChatInput,
        defaultMemberPermissions: PermissionFlagsBits.KickMembers,
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
            max_length: 1024
          }
        ]
      }
    });
  }

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig,
    ephemeral: boolean
  ): Promise<InteractionReplyData> {
    const target = interaction.options.getMember('target');
    const rawReason = interaction.options.getString('reason', false);

    if (!target) {
      return {
        error: MessageKeys.Errors.MemberNotFound,
        temporary: true
      };
    }

    const vResult = InfractionManager.validateAction({
      config,
      guild: interaction.guild,
      target,
      executor: interaction.member,
      action: 'Kick',
      reason: rawReason
    });

    if (!vResult.success) {
      return {
        error: vResult.message,
        temporary: true
      };
    }

    await interaction.deferReply({ ephemeral });

    let kResult = true;
    const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guildId: interaction.guildId,
      targetId: target.id,
      executorId: interaction.user.id,
      type: 'Kick',
      reason,
      createdAt: Date.now()
    });

    await InfractionManager.sendNotificationDM({ config, guild: interaction.guild, target, infraction });

    await InfractionManager.resolvePunishment({
      guild: interaction.guild,
      executor: interaction.member,
      target,
      action: 'Kick',
      reason,
      duration: null
    }).catch(() => {
      kResult = false;
    });

    if (!kResult) {
      await InfractionManager.deleteInfraction({ id: infraction.id });
      return {
        error: MessageKeys.Errors.PunishmentFailed('Kick', target),
        temporary: true
      };
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
