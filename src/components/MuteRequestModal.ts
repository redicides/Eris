import { ModalSubmitInteraction } from 'discord.js';

import { RequestUtils } from '@utils/Requests';
import { hasPermission } from '@utils/index';
import { GuildConfig } from '@utils/Types';

import Component from '@managers/components/Component';

export default class MuteRequestModalComponent extends Component {
  constructor() {
    super({ matches: /^mute-request-(accept|deny)-\d{17,19}$/m });
  }

  async execute(interaction: ModalSubmitInteraction<'cached'>, config: GuildConfig) {
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny';
    const requestId = interaction.customId.split('-')[3];

    const request = await this.prisma.muteRequest.findUnique({
      where: { id: requestId, guildId: interaction.guildId }
    });

    if (!request) {
      setTimeout(async () => {
        await interaction.message?.delete().catch(() => null);
      }, 7000);

      return {
        error: 'Failed to fetch the related mute request. I will attempt to delete the alert in **7 seconds**.',
        temporary: true
      };
    }

    if (!hasPermission(interaction.member, config, 'ManageMuteRequests')) {
      return {
        error: 'You no longer have permission to manage mute requests.',
        temporary: true
      };
    }

    const reason = interaction.fields.getTextInputValue('reason');

    return RequestUtils.handleMuteRequestAction({ interaction, config, request, action, reason });
  }
}
