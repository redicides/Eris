import { ModalSubmitInteraction } from 'discord.js';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { ReportUtils } from '@/utils/Reports';

import Component from '@managers/components/Component';

export default class ReportUserComponent extends Component {
  constructor() {
    super({ matches: /^report-user-\d{17,19}$/m });
  }

  async execute(interaction: ModalSubmitInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData> {
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

    const targetId = interaction.customId.split('-')[2];

    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
    const target = targetMember?.user ?? (await interaction.client.users.fetch(targetId).catch(() => null));

    if (!target) {
      return {
        error: 'The target user could not be found.',
        temporary: true
      };
    }

    if (!targetMember && config.userReportsRequireMember) {
      return {
        error: 'You cannot report this user because they are not a member of this server.',
        temporary: true
      };
    }

    if (targetMember) {
      if (targetMember.roles.cache.some(role => config.userReportsImmuneRoles.includes(role.id))) {
        return {
          error: 'You cannot report this user.',
          temporary: true
        };
      }
    }

    const reason = interaction.fields.getTextInputValue('report-reason');

    if (!reason.match(/\w/g)) {
      return {
        error: 'You must provide a valid reason for reporting this user.',
        temporary: true
      };
    }

    return ReportUtils.createUserReport({ interaction, config, target, reason });
  }
}
