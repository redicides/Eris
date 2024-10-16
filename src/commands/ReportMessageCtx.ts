import {
  MessageContextMenuCommandInteraction,
  ApplicationCommandType,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalBuilder
} from 'discord.js';
import { Guild as Config, ReportStatus } from '@prisma/client';

import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';
import CacheManager from '@managers/database/CacheManager';

export default class ReportMessageCtx extends Command<MessageContextMenuCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Moderation,
      data: {
        name: 'Report Message',
        type: ApplicationCommandType.Message
      }
    });
  }

  async execute(
    interaction: MessageContextMenuCommandInteraction<'cached'>,
    config: Config
  ): Promise<InteractionReplyData | null> {
    if (!config.messageReportsEnabled) {
      return {
        error: 'User reports are disabled in this server.',
        temporary: true
      };
    }

    if (config.messageReportsBlacklist.includes(interaction.user.id)) {
      return {
        error: 'You are blacklisted from submitting message reports in this server.',
        temporary: true
      };
    }

    if (!config.messageReportsWebhook) {
      return {
        error: 'Message reports are not configured in this server.',
        temporary: true
      };
    }

    const message = interaction.targetMessage;
    const targetUser = interaction.targetMessage.author;
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetUser) {
      return {
        error: 'The author of the target message could not be found.',
        temporary: true
      };
    }

    if (!targetMember && config.userReportsRequireMember) {
      return {
        error: 'You cannot report this message because the author is not a member of this server.',
        temporary: true
      };
    }

    if (targetMember) {
      if (targetMember.roles.cache.some(role => config.userReportsImmuneRoles.includes(role.id))) {
        return {
          error: 'You cannot report this message.',
          temporary: true
        };
      }
    }

    if (message.author.bot) {
      return {
        error: 'You cannot report messages sent by bots.',
        temporary: true
      };
    }

    if (targetUser.id === interaction.user.id) {
      return {
        error: 'You cannot report your own messages.',
        temporary: true
      };
    }

    if (targetUser.id === interaction.guild.ownerId) {
      return {
        error: "You cannot report the server owner's messages.",
        temporary: true
      };
    }

    const report = await this.prisma.messageReport.findFirst({
      where: {
        guildId: interaction.guildId,
        messageId: message.id,
        reportedBy: interaction.user.id,
        status: ReportStatus.Pending
      }
    });

    if (report) {
      return {
        error: 'You have already reported this message.',
        temporary: true
      };
    }

    const reasonText = new TextInputBuilder()
      .setCustomId('report-reason')
      .setLabel('Reason')
      .setPlaceholder(`Enter the reason for reporting @${targetUser.username}'s message`)
      .setRequired(true)
      .setMaxLength(1024)
      .setStyle(TextInputStyle.Paragraph);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().setComponents(reasonText);

    const modal = new ModalBuilder()
      .setCustomId(`report-message-${message.channel.id}-${message.id}`)
      .setTitle(`Report @${targetUser.username}'s message`)
      .setComponents(actionRow);

    await interaction.showModal(modal);
    return null;
  }
}
