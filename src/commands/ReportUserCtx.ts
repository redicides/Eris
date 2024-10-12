import {
  ActionRowBuilder,
  ApplicationCommandType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserContextMenuCommandInteraction
} from 'discord.js';
import { Guild as Config, ReportStatus } from '@prisma/client';

import { InteractionReplyData } from '@/utils/Types';

import Command, { CommandCategory } from '@/managers/commands/Command';

export default class ReportUserCtx extends Command<UserContextMenuCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      data: {
        name: 'Report User',
        type: ApplicationCommandType.User
      }
    });
  }

  async execute(
    interaction: UserContextMenuCommandInteraction<'cached'>,
    config: Config
  ): Promise<InteractionReplyData | null> {
    if (!config.userReportsEnabled) {
      return {
        error: 'User reports are disabled in this server.',
        temporary: true
      };
    }

    if (config.userReportsBlacklist.includes(interaction.user.id)) {
      return {
        error: 'You are blacklisted from submitting user reports in this server.',
        temporary: true
      };
    }

    if (!config.userReportsWebhook) {
      return {
        error: 'User reports are not configured in this server.',
        temporary: true
      };
    }

    const targetMember = interaction.targetMember;
    const target = targetMember?.user ?? interaction.targetUser;

    if (!target) {
      return {
        error: 'The target user could not be found.',
        temporary: true
      };
    }

    if (target.id === interaction.user.id) { 
      return { 
        error: 'You cannot report yourself.',
        temporary: true
      }
    }

    if (target.id === this.client.user!.id) { 
      return { 
        error: 'You cannot report me.',
        temporary: true
      }
    }

    if (targetMember) {
      if (targetMember.roles.cache.some(role => config.userReportsImmuneRoles.includes(role.id))) {
        return {
          error: 'You cannot report this user.',
          temporary: true
        };
      }
    }

    const report = await this.prisma.userReport.findFirst({
      where: {
        guildId: interaction.guildId,
        targetId: target.id,
        reportedBy: interaction.user.id,
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
