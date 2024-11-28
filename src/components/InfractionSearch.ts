import { ButtonInteraction } from 'discord.js';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { hasPermission } from '@utils/index';
import { MessageKeys } from '@utils/Keys';

import Component from '@managers/components/Component';
import InfractionManager from '@managers/database/InfractionManager';

export default class InfractionSearchComponent extends Component {
  constructor() {
    super({ matches: /^infraction-search-\d{17,19}$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData> {
    const targetId = interaction.customId.split('-')[2];
    const target = await this.client.users.fetch(targetId).catch(() => null);

    if (!hasPermission(interaction.member, config, 'SearchInfractions')) {
      return {
        error: MessageKeys.Errors.MissingUserPermission('SearchInfractions', 'search infractions'),
        temporary: true
      };
    }

    if (!target) {
      return {
        error: 'The target user could not be found.',
        temporary: true
      };
    }

    return InfractionManager.searchInfractions({
      guildId: interaction.guildId,
      controllerId: interaction.user.id,
      target,
      filter: null,
      page: 1
    });
  }
}
