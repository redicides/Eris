import { ModalSubmitInteraction } from 'discord.js';

import { MessageKeys } from '@utils/Keys';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { hasPermission } from '@utils/index';
import { ReportUtils } from '@utils/Reports';

import Component from '@managers/components/Component';

export default class MessageReportModalComponent extends Component {
  constructor() {
    super({ matches: /^message-report-(accept|deny)-\d{17,19}$/m });
  }

  async execute(
    interaction: ModalSubmitInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData | null> {
    const reportId = interaction.customId.split('-')[3];
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny';

    if (!hasPermission(interaction.member, config, 'ManageMessageReports')) {
      return {
        error: MessageKeys.Errors.MissingUserPermission('ManageMessageReports', 'manage message reports'),
        temporary: true
      };
    }

    const report = await this.prisma.messageReport.findUnique({
      where: { id: reportId, guildId: interaction.guildId }
    });

    if (!report) {
      setTimeout(async () => {
        await interaction.message?.delete().catch(() => null);
      }, 7000);

      return {
        error: 'Failed to fetch the related report. I will attempt to delete the alert in **7 seconds**.',
        temporary: true
      };
    }

    const reason = interaction.fields.getTextInputValue('reason');

    return ReportUtils.handleMessageReportAction({ interaction, config, report, action, reason });
  }
}
