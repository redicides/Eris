import { ActionRowBuilder, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

import { InteractionReplyData } from '@utils/Types';

import Component from '@managers/components/Component';

export default class MessageReportComponent extends Component {
  constructor() {
    super({ matches: /^message-report-(accept|deny|disregard)$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>): Promise<InteractionReplyData | null> {
    const report = await this.prisma.messageReport.findUnique({
      where: {
        id: interaction.message.id,
        guildId: interaction.guildId
      }
    });

    if (!report) {
      setTimeout(async () => {
        await interaction.message.delete().catch(() => null);
        await interaction.deleteReply().catch(() => null);
      }, 7000);

      return {
        error: 'Failed to fetch the related report. Log will delete in **7 seconds**.',
        temporary: true
      };
    }

    const action = interaction.customId.split('-')[2] as 'accept' | 'deny' | 'disregard';

    switch (action) {
      case 'disregard': {
        await this.prisma.messageReport.update({
          where: { id: interaction.message.id },
          data: { status: 'Disregarded' }
        });

        await interaction.message.delete().catch(() => null);

        return {
          content: 'Successfully disregarded the report.',
          temporary: true
        };
      }

      case 'accept':
      case 'deny': {
        const reasonText = new TextInputBuilder()
          .setCustomId(`reason`)
          .setLabel('Reason')
          .setPlaceholder(`Enter the reason for ${action === 'accept' ? 'accepting' : 'denying'} this report`)
          .setRequired(true)
          .setMaxLength(1024)
          .setStyle(TextInputStyle.Paragraph);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().setComponents(reasonText);

        const modal = new ModalBuilder()
          .setCustomId(`message-report-${action === 'accept' ? 'accept' : 'deny'}-${report.id}`)
          .setTitle(`Action Reason`)
          .setComponents(actionRow);

        await interaction.showModal(modal);
        return null;
      }

      default:
        return {
          error: 'Unknown action.',
          temporary: true
        };
    }
  }
}
