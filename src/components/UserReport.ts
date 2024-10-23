import { ButtonInteraction } from 'discord.js';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { ReportUtils } from '@utils/Reports';
import { capitalize } from '@utils/index';

import Component from '@managers/components/Component';

export default class UserReportComponent extends Component {
  constructor() {
    super({ matches: /^user-report-(accept|deny|disregard)$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData | null> {
    const report = await this.prisma.userReport.findUnique({
      where: {
        id: interaction.message.id,
        guildId: interaction.guildId
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
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny' | 'disregard';
    const key = `userReportsRequire${capitalize(action)}Reason` as keyof typeof config;

    if (action === 'disregard') {
      await this.prisma.userReport.update({
        where: { id: report.id },
        data: { status: 'Disregarded' }
      });

      await interaction.message.delete().catch(() => null);

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
