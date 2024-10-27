import { ButtonInteraction } from 'discord.js';

import { InteractionReplyData } from '@utils/Types';

import Infraction from '@/commands/Infraction';
import Component from '@managers/components/Component';

export default class InfractionSearchComponent extends Component {
  constructor() {
    super({ matches: /^infraction-search-\d{17,19}$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>): Promise<InteractionReplyData> {
    const targetId = interaction.customId.split('-')[2];
    const target = await this.client.users.fetch(targetId).catch(() => null);

    if (!target) {
      return {
        error: 'The target user could not be found.',
        temporary: true
      };
    }

    return Infraction.search({
      guildId: interaction.guildId,
      target,
      filter: null,
      page: 1
    });
  }
}
