import { ModalSubmitInteraction } from 'discord.js';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { ReportUtils } from '@utils/Reports';

import Component from '@managers/components/Component';

export default class UserReportManagerComponent extends Component {
  constructor() {
    super({ matches: /^user-report-(accept|deny)-\d{17,19}$/m });
  }

  async execute(
    interaction: ModalSubmitInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData | null> {
    const reportId = interaction.customId.split('-')[3];
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny';

    const report = await this.prisma.userReport.findUnique({
      where: { id: reportId, guildId: interaction.guildId }
    });

    if (!report) {
      setTimeout(async () => {
        await interaction.message?.delete().catch(() => null);
      }, 7000);

      return {
        error: 'Failed to fetch the related report. Log will delete in **7 seconds**.',
        temporary: true
      };
    }

    const reason = interaction.fields.getTextInputValue('reason');

    return ReportUtils.handleUserReportAction({ interaction, config, report, action, reason });
  }
}
