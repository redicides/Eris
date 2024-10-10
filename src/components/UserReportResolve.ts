import { ButtonInteraction } from 'discord.js';

import { prisma } from '@/index';
import { InteractionReplyData } from '@/utils/Types';

import Component from '@/managers/components/Component';

export default class UserReportResolve extends Component {
  constructor() {
    super('user-report-resolve');
  }

  async execute(interaction: ButtonInteraction<'cached'>): Promise<InteractionReplyData> {
    const report = await prisma.userReport
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
      await interaction.message.delete().catch(() => null);
      return {
        error: 'Failed to fetch the related report... Log deleted without resolving.'
      };
    }

    await interaction.message.delete().catch(() => null);

    return {
      content: `Successfully resolved the report.`,
      temporary: true
    };
  }
}
