import { ButtonInteraction, EmbedBuilder, EmbedData } from 'discord.js';

import { MessageKeys } from '@utils/Keys';
import { hasPermission } from '@utils/index';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { ReportUtils } from '@utils/Reports';
import { UserPermission } from '@utils/Enums';
import { userMentionWithId } from '@utils/index';
import { DefaultInfractionReason } from '@managers/database/InfractionManager';

import Component from '@terabyte/Component';

export default class UserReportButtonsComponent extends Component {
  constructor() {
    super({ matches: /^user-report-(accept|deny|disregard)$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData | null> {
    if (!hasPermission(interaction.member, config, UserPermission.ManageUserReports)) {
      return {
        error: MessageKeys.Errors.MissingUserPermission(UserPermission.ManageUserReports, 'manage user reports'),
        temporary: true
      };
    }

    const report = await this.prisma.userReport.findUnique({
      where: {
        id: interaction.message.id,
        guild_id: interaction.guildId
      }
    });

    if (!report) {
      setTimeout(async () => {
        await interaction.message.delete().catch(() => null);
      }, 7000);

      return {
        error: 'Failed to fetch the related report. I will attempt to delete the alert in **7 seconds**.',
        temporary: true
      };
    }

    if (report.resolved_by) {
      setTimeout(async () => {
        await interaction.message.delete().catch(() => null);
      }, 7500);

      return {
        error: `This report has already been ${
          report.status === 'AutoResolved'
            ? 'automatically resolved due to a ban'
            : `resolved by ${userMentionWithId(report.resolved_by)}`
        }. I will attempt to delete the alert in **7 seconds**.`,
        temporary: true
      };
    }

    const action = interaction.customId.split('-')[2] as 'accept' | 'deny' | 'disregard';
    const key = `user_reports_require_${action}_reason` as keyof typeof config;

    if (action === 'disregard') {
      await this.prisma.userReport.update({
        where: { id: report.id },
        data: { status: 'Disregarded' }
      });

      await interaction.message.delete().catch(() => null);

      const components = interaction.message?.components!.length;

      const log = new EmbedBuilder(interaction.message!.embeds[components === 1 ? 0 : 1] as EmbedData)
        .setAuthor({ name: 'User Report' })
        .setFooter({ text: `Report ID: #${report.id}` })
        .setTimestamp();

      await ReportUtils.sendLog({
        config,
        userId: interaction.user.id,
        action: 'Disregarded',
        reason: DefaultInfractionReason,
        embed: log
      });

      return {
        content: 'Successfully disregarded the report.',
        temporary: true
      };
    } else {
      if (config[key]) {
        const modal = ReportUtils.buildModal({ action, reportType: 'user', reportId: report.id });
        await interaction.showModal(modal);
        return null;
      }

      return ReportUtils.handleUserReportAction({
        interaction,
        config,
        report,
        action,
        reason: null
      });
    }
  }
}
