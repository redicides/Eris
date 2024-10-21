import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager, { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';

export default class Unmute extends Command<ChatInputCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      requiredPermissions: PermissionFlagsBits.ModerateMembers,
      usage: '<target> [reason]',
      data: {
        name: 'unmute',
        description: 'Unmute a member in the server.',
        defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'target',
            description: 'The member to unmute.',
            type: ApplicationCommandOptionType.User,
            required: true
          },
          {
            name: 'reason',
            description: 'The reason for unmuting the target.',
            type: ApplicationCommandOptionType.String,
            required: false,
            max_length: 1000
          }
        ]
      }
    });
  }

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData> {
    const target = interaction.options.getMember('target');
    const rawReason = interaction.options.getString('reason', false);

    if (!target) {
      return {
        error: 'The provided user is not a member of this server.',
        temporary: true
      };
    }

    const vResult = InfractionManager.validateAction({
      guild: interaction.guild,
      target,
      executor: interaction.member!,
      action: 'Unmute'
    });

    if (!vResult.success) {
      return {
        error: vResult.message,
        temporary: true
      };
    }

    const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

    let mResult = true;

    await interaction.deferReply({ ephemeral: true });

    await InfractionManager.resolvePunishment({
      guild: interaction.guild,
      target,
      executor: interaction.member!,
      action: 'Mute',
      reason,
      duration: null
    }).catch(() => {
      mResult = false;
    });

    if (!mResult) {
      return {
        error: `Failed to unmute ${target}.`,
        temporary: true
      };
    }

    const infraction = await InfractionManager.storeInfraction({
      guildId: interaction.guild.id,
      targetId: target.id,
      executorId: interaction.user.id,
      type: 'Unmute',
      reason,
      createdAt: Date.now(),
      expiresAt: null
    });

    await TaskManager.deleteTask({
      where: { targetId_guildId_type: { targetId: target.id, guildId: interaction.guild.id, type: 'Mute' } }
    }).catch(() => null);

    InfractionManager.sendNotificationDM({ guild: interaction.guild, target, infraction });
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
