import { ModalSubmitInteraction, TextChannel } from 'discord.js';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { ReportUtils } from '@/utils/Reports';

import Component from '@managers/components/Component';

export default class ReportMessageComponent extends Component {
  constructor() {
    super({ matches: /^report-message-\d{17,19}-\d{17,19}$/m });
  }

  async execute(interaction: ModalSubmitInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData> {
    if (!config.messageReportsEnabled) {
      return {
        error: 'Message reports are disabled in this server.',
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

    const channelId = interaction.customId.split('-')[2];
    const messageId = interaction.customId.split('-')[3];

    const channel = (await interaction.guild.channels.fetch(channelId).catch(() => null)) as TextChannel;
    if (!channel) {
      return {
        error: `Failed to fetch the channel for message with ID ${messageId}.`,
        temporary: true
      };
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return {
        error: `Failed to fetch the message with ID ${messageId}.`,
        temporary: true
      };
    }

    const target = message.author;
    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!target) {
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

    const reason = interaction.fields.getTextInputValue('report-reason');

    if (!reason.match(/\w/g)) {
      return {
        error: 'You must provide a valid reason for reporting this message.',
        temporary: true
      };
    }

    return ReportUtils.createMessageReport({ interaction, config, target, message, reason });
  }
}
