import { ModalSubmitInteraction } from 'discord.js';

import { MessageKeys } from '@utils/Keys';
import { hasPermission } from '@utils/index';
import { RequestUtils } from '@utils/Requests';
import { GuildConfig } from '@utils/Types';

import Component from '@managers/components/Component';

export default class BanRequestModalComponent extends Component {
  constructor() {
    super({ matches: /^ban-request-(accept|deny)-\d{17,19}$/m });
  }

  async execute(interaction: ModalSubmitInteraction<'cached'>, config: GuildConfig) {
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny';
    const requestId = interaction.customId.split('-')[3];

    if (!hasPermission(interaction.member, config, 'ManageBanRequests')) {
      return {
        error: MessageKeys.Errors.MissingUserPermission('ManageBanRequests', 'manage ban requests'),
        temporary: true
      };
    }

    const request = await this.prisma.banRequest.findUnique({
      where: { id: requestId, guildId: interaction.guildId }
    });

    if (!request) {
      setTimeout(async () => {
        await interaction.message?.delete().catch(() => null);
      }, 7000);

      return {
        error: 'Failed to fetch the related ban request. I will attempt to delete the alert in **7 seconds**.',
        temporary: true
      };
    }

    const reason = interaction.fields.getTextInputValue('reason');

    return RequestUtils.handleBanRequestAction({ interaction, config, request, action, reason });
  }
}
