import { ButtonInteraction, ComponentType } from 'discord.js';

import { prisma } from '@/index';

import { InteractionReplyData } from '@utils/Types';
import { YES_NO_ROW } from '@utils/Constants';

import Component from '@managers/components/Component';

export default class MessageReportResolveComponent extends Component {
  constructor() {
    super('message-report-resolve');
  }

  async execute(interaction: ButtonInteraction<'cached'>): Promise<InteractionReplyData> {
    const report = await prisma.messageReport
      .update({
        where: { id: interaction.message.id },
        data: {
          status: 'Accepted',
          resolvedBy: interaction.user.id,
          resolvedAt: Date.now()
        }
      })
      .catch(() => null);

    if (!report) {
      const reply = await interaction.reply({
        content: 'Failed to fetch the related report. Delete the log without resolving?',
        ephemeral: true,
        components: [YES_NO_ROW],
        fetchReply: true
      });

      const res = await reply
        .awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30000
        })
        .catch(() => null);

      if (!res) {
        return {
          content: 'Operation timed out. Report log not deleted.',
          components: []
        };
      }

      if (res.customId === '?yes') {
        await interaction.message.delete().catch(() => null);
        return {
          content: 'Successfully resolved the report.',
          components: []
        };
      }

      return {
        content: 'Successfully resolved the report without deleting the log.',
        components: []
      };
    }

    await interaction.message.delete().catch(() => null);

    return {
      content: `Successfully resolved the report.`,
      temporary: true
    };
  }
}
