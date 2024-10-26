import { ButtonInteraction, EmbedBuilder, EmbedData } from 'discord.js';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { ReportUtils } from '@utils/Reports';
import { capitalize } from '@utils/index';

import Component from '@managers/components/Component';
import { DEFAULT_INFRACTION_REASON } from '@/managers/database/InfractionManager';

export default class MessageReportComponent extends Component {
  constructor() {
    super({ matches: /^message-report-(accept|deny|disregard)$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData | null> {
    const report = await this.prisma.messageReport.findUnique({
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
    const key = `messageReportsRequire${capitalize(action)}Reason` as keyof typeof config;

    if (action === 'disregard') {
      await this.prisma.messageReport.update({
        where: { id: report.id },
        data: { status: 'Disregarded' }
      });

      const components = interaction.message?.components!.length;

      const log = new EmbedBuilder(interaction.message!.embeds[components === 1 ? 0 : 1] as EmbedData)
        .setAuthor({ name: 'Message Report' })
        .setFooter({ text: `Report ID: #${report.id}` })
        .setTimestamp();

      await interaction.message.delete().catch(() => null);

      await ReportUtils.sendLog({
        config,
        embed: log,
        userId: interaction.user.id,
        action: 'Disregarded',
        reason: DEFAULT_INFRACTION_REASON
      });

      return {
        content: 'Successfully disregarded the report.',
        temporary: true
      };
    } else {
      if (config[key]) {
        const modal = ReportUtils.buildModal({ action, reportType: 'message', reportId: report.id });
        await interaction.showModal(modal);
        return null;
      }

      return ReportUtils.handleMessageReportAction({
        interaction,
        config,
        report,
        action,
        reason: null
      });
    }
  }
}
