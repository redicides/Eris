import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import { isEphemeralReply } from '@utils/index';
import { MessageKeys } from '@utils/Keys';
import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Command, { CommandCategory } from '@terabyte/Command';
import InfractionManager, { DefaultInfractionReason } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';

export default class Unban extends Command {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      requiredPermissions: PermissionFlagsBits.BanMembers,
      usage: '<target> [reason]',
      data: {
        name: 'unban',
        description: 'Unban a user from the server.',
        defaultMemberPermissions: PermissionFlagsBits.BanMembers,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'target',
            description: 'The user to unban.',
            type: ApplicationCommandOptionType.User,
            required: true
          },
          {
            name: 'reason',
            description: 'The reason for unbanning the target.',
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
    config: GuildConfig
  ): Promise<InteractionReplyData> {
    const target = interaction.options.getUser('target');
    const rawReason = interaction.options.getString('reason', false);

    if (!target) {
      return {
        error: MessageKeys.Errors.TargetNotFound,
        temporary: true
      };
    }

    const vResult = InfractionManager.validateAction({
      config,
      guild: interaction.guild,
      target,
      executor: interaction.member,
      action: 'Unban',
      reason: rawReason
    });

    if (!vResult.success) {
      return {
        error: vResult.message,
        temporary: true
      };
    }

    if (!(await interaction.guild.bans.fetch(target.id).catch(() => null))) {
      return {
        error: 'You cannot unban someone who is not banned.',
        temporary: true
      };
    }

    const reason = rawReason ?? DefaultInfractionReason;

    await interaction.deferReply({ ephemeral: isEphemeralReply(interaction, config) });

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guild_id: interaction.guildId,
      target_id: target.id,
      executor_id: interaction.user.id,
      action: 'Unban',
      reason
    });

    const unban = await InfractionManager.resolvePunishment({
      guild: interaction.guild,
      target,
      executor: interaction.member,
      action: 'Unban',
      reason
    });

    if (!unban.success) {
      await InfractionManager.deleteInfraction({ id: infraction.id });

      return {
        error: MessageKeys.Errors.PunishmentFailed('Unban', target),
        temporary: true
      };
    }

    Promise.all([
      TaskManager.deleteTask({
        target_id_guild_id_action: { guild_id: interaction.guildId, target_id: target.id, action: 'Ban' }
      }),
      InfractionManager.logInfraction(config, infraction)
    ]);

    return {
      embeds: [
        {
          description: InfractionManager.getSuccessMessage(infraction, target),
          color: InfractionManager.mapActionToColor('Unban')
        }
      ]
    };
  }
}
