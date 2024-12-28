import {
  MessageContextMenuCommandInteraction,
  ApplicationCommandType,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalBuilder
} from 'discord.js';
import { ReportStatus } from '@prisma/client';

import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Command, { CommandCategory } from '@eris/Command';

export default class ReportMessageCtx extends Command {
  constructor() {
    super({
      category: CommandCategory.Context,
      data: {
        name: 'Report Message',
        type: ApplicationCommandType.Message
      }
    });
  }

  async execute(
    interaction: MessageContextMenuCommandInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData | null> {
    if (!config.message_reports_enabled) {
      return {
        error: 'Message reports are disabled in this server.',
        temporary: true
      };
    }

    if (config.message_reports_blacklist.includes(interaction.user.id)) {
      return {
        error: 'You are blacklisted from submitting message reports in this server.',
        temporary: true
      };
    }

    if (!config.message_reports_webhook) {
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

    if (!targetMember && config.message_reports_require_member) {
      return {
        error: 'You cannot report this message because the author is not a member of this server.',
        temporary: true
      };
    }

    if (targetMember) {
      if (targetMember.roles.cache.some(role => config.message_reports_immune_roles.includes(role.id))) {
        return {
          error: 'You cannot report this message.',
          temporary: true
        };
      }
    }

    if (message.author.bot || message.webhookId) {
      return {
        error: 'You cannot report messages sent by bots or webhooks.',
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
        guild_id: interaction.guildId,
        message_id: message.id,
        reported_by: interaction.user.id,
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
