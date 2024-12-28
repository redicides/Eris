import { ModalSubmitInteraction } from 'discord.js';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { UserPermission } from '@utils/Enums';
import { hasPermission } from '@utils/index';
import { ReportUtils } from '@utils/Reports';
import { MessageKeys } from '@utils/Keys';

import Component from '@eris/Component';

export default class UserReportModalComponent extends Component {
  constructor() {
    super({ matches: /^user-report-(accept|deny)-\d{17,19}$/m });
  }

  async execute(
    interaction: ModalSubmitInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData | null> {
    const reportId = interaction.customId.split('-')[3];
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny';

    if (!hasPermission(interaction.member, config, UserPermission.ManageUserReports)) {
      return {
        error: MessageKeys.Errors.MissingUserPermission(UserPermission.ManageUserReports, 'manage user reports'),
        temporary: true
      };
    }

    const report = await this.prisma.userReport.findUnique({
      where: { id: reportId, guild_id: interaction.guildId }
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

    return ReportUtils.handleUserReportAction({ interaction, config, report, action, reason });
  }
}
