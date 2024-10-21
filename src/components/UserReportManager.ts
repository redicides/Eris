import { Colors, EmbedBuilder, ModalSubmitInteraction } from 'discord.js';

import { InteractionReplyData } from '@utils/Types';
import { userMentionWithId } from '@utils/index';

import Component from '@managers/components/Component';

export default class UserReportManagerComponent extends Component {
  constructor() {
    super({ matches: /^user-report-(accept|deny)-\d{17,19}$/m });
  }

  async execute(interaction: ModalSubmitInteraction<'cached'>): Promise<InteractionReplyData | null> {
    const reportId = interaction.customId.split('-')[3];
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny';

    const report = await this.prisma.userReport.findUnique({
      where: { id: reportId, guildId: interaction.guildId },
      include: { guild: true }
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
    const user = await this.client.users.fetch(report.reportedBy).catch(() => null);

    const notification = new EmbedBuilder()
      .setColor(action === 'accept' ? Colors.Green : Colors.Red)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
      .setTitle(`Report ${action === 'accept' ? 'Accepted' : 'Denied'}`)
      .setDescription(
        `Hi, ${user!.toString()}. Your user report against ${userMentionWithId(report.targetId)} has been ${
          action === 'accept' ? 'accepted' : 'denied'
        }.`
      )
      .setFields([{ name: 'Reason', value: reason }])
      .setFooter({ text: `Report ID: #${report.id}` })
      .setTimestamp();

    switch (action) {
      case 'accept': {
        await this.prisma.userReport.update({
          where: { id: report.id },
          data: {
            resolvedAt: Date.now(),
            resolvedBy: interaction.user.id,
            status: 'Accepted'
          }
        });

        if (user && report.guild.userReportsNotifyStatus) {
          await user.send({ embeds: [notification] }).catch(() => null);
        }

        await interaction.message?.delete().catch(() => null);

        return {
          content: `Successfully accepted the report - ID \`#{report.id}\``,
          temporary: true
        };
      }

      case 'deny': {
        await this.prisma.userReport.update({
          where: { id: report.id },
          data: {
            resolvedAt: Date.now(),
            resolvedBy: interaction.user.id,
            status: 'Denied'
          }
        });

        if (user && report.guild.userReportsNotifyStatus) {
          await user.send({ embeds: [notification] }).catch(() => null);
        }

        await interaction.message?.delete().catch(() => null);

        return {
          content: `Successfully denied the report - ID \`#{report.id}\``,
          temporary: true
        };
      }

      default:
        return {
          error: 'Unknown action.',
          temporary: true
        };
    }
  }
}
