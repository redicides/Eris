import {
  ActionRowBuilder,
  ApplicationCommandType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserContextMenuCommandInteraction
} from 'discord.js';
import { ReportStatus } from '@prisma/client';

import { MessageKeys } from '@utils/Keys';
import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class ReportUserCtx extends Command {
  constructor() {
    super({
      category: CommandCategory.Context,
      data: {
        name: 'Report User',
        type: ApplicationCommandType.User
      }
    });
  }

  async execute(
    interaction: UserContextMenuCommandInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData | null> {
    if (!config.user_reports_enabled) {
      return {
        error: 'User reports are disabled in this server.',
        temporary: true
      };
    }

    if (config.user_reports_blacklist.includes(interaction.user.id)) {
      return {
        error: 'You are blacklisted from submitting user reports in this server.',
        temporary: true
      };
    }

    if (!config.user_reports_webhook) {
      return {
        error: 'User reports are not configured in this server.',
        temporary: true
      };
    }

    const targetMember = interaction.targetMember;
    const target = targetMember?.user ?? interaction.targetUser;

    if (!target) {
      return {
        error: MessageKeys.Errors.TargetNotFound,
        temporary: true
      };
    }

    if (!targetMember && config.user_reports_require_member) {
      return {
        error: 'You cannot report this user because they are not a member of this server.',
        temporary: true
      };
    }

    if (target.id === interaction.user.id) {
      return {
        error: 'You cannot report yourself.',
        temporary: true
      };
    }

    if (target.id === interaction.guild.ownerId) {
      return {
        error: 'You cannot report the owner of this server.',
        temporary: true
      };
    }

    if (target.id === this.client.user!.id) {
      return {
        error: 'You cannot report me.',
        temporary: true
      };
    }

    if (targetMember) {
      if (targetMember.roles.cache.some(role => config.user_reports_immune_roles.includes(role.id))) {
        return {
          error: 'You cannot report this user.',
          temporary: true
        };
      }
    }

    const report = await this.prisma.userReport.findFirst({
      where: {
        guild_id: interaction.guildId,
        target_id: target.id,
        reported_by: interaction.user.id,
        status: ReportStatus.Pending
      }
    });

    if (report) {
      return {
        error: 'You have already reported this user once.',
        temporary: true
      };
    }

    const reasonText = new TextInputBuilder()
      .setCustomId('report-reason')
      .setLabel('Reason')
      .setPlaceholder(`Enter the reason for reporting @${target.username}`)
      .setRequired(true)
      .setMaxLength(1024)
      .setStyle(TextInputStyle.Paragraph);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().setComponents(reasonText);

    const modal = new ModalBuilder()
      .setCustomId(`report-user-${target.id}`)
      .setTitle(`Report @${target.username}`)
      .setComponents(actionRow);

    await interaction.showModal(modal);
    return null;
  }
}
