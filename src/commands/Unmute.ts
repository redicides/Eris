import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import { isEphemeralReply } from '@utils/index';
import { MessageKeys } from '@utils/Keys';
import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';
import InfractionManager, { DefaultInfractionReason } from '@managers/database/InfractionManager';
import TaskManager from '@managers/database/TaskManager';

export default class Unmute extends Command {
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
      action: 'Unmute',
      reason: rawReason
    });

    if (!vResult.success) {
      return {
        error: vResult.message,
        temporary: true
      };
    }

    const reason = rawReason ?? DefaultInfractionReason;

    await interaction.deferReply({ ephemeral: isEphemeralReply(interaction, config) });

    const unmute = await InfractionManager.resolvePunishment({
      guild: interaction.guild,
      target,
      executor: interaction.member,
      action: 'Unmute',
      reason
    });

    if (!unmute.success) {
      return {
        error: MessageKeys.Errors.PunishmentFailed('Unmute', target),
        temporary: true
      };
    }

    const infraction = await InfractionManager.storeInfraction({
      id: InfractionManager.generateInfractionId(),
      guild_id: interaction.guild.id,
      target_id: target.id,
      executor_id: interaction.user.id,
      type: 'Unmute',
      reason,
      created_at: Date.now()
    });

    Promise.all([
      TaskManager.deleteTask({
        target_id_guild_id_type: { target_id: target.id, guild_id: interaction.guild.id, type: 'Mute' }
      }),
      InfractionManager.sendNotificationDM({ config, guild: interaction.guild, target, infraction }),
      InfractionManager.logInfraction(config, infraction)
    ]);

    return {
      embeds: [
        {
          description: InfractionManager.getSuccessMessage(infraction, target),
          color: InfractionManager.mapActionToColor('Unmute')
        }
      ]
    };
  }
}
