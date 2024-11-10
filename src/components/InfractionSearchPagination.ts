import { ButtonComponent, ButtonInteraction } from 'discord.js';
import { InfractionFlag } from '@prisma/client';

import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { hasPermission } from '@utils/index';
import { client } from '..';

import Component from '@managers/components/Component';
import InfractionManager from '@managers/database/InfractionManager';

export default class InfractionSearchPaginationComponent extends Component {
  constructor() {
    super({ matches: /^infraction-search-(next|back|last|first)-\d{17,19}$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData | null> {
    const direction = interaction.customId.split('-')[2] as 'next' | 'back' | 'last' | 'first';
    const controllerId = interaction.customId.split('-')[3];

    if (controllerId !== interaction.user.id) {
      return {
        error: 'Only the user who initiated the search can use these buttons.',
        temporary: true
      };
    }

    if (!hasPermission(interaction.member, config, 'SearchInfractions')) {
      return {
        error: "You no longer have permission to search this user's infractions.",
        temporary: true
      };
    }

    await interaction.deferUpdate();

    switch (direction) {
      case 'next':
        return InfractionSearchPaginationComponent.handleInfractionSearchPagination({
          interaction,
          options: { pageOffset: 1 }
        });
      case 'back':
        return InfractionSearchPaginationComponent.handleInfractionSearchPagination({
          interaction,
          options: { pageOffset: -1 }
        });
      case 'first':
        return InfractionSearchPaginationComponent.handleInfractionSearchPagination({
          interaction,
          options: { page: 1 }
        });
      case 'last':
        return InfractionSearchPaginationComponent.handleInfractionSearchPagination({
          interaction,
          options: { page: 0 }
        });
    }
  }

  public static async handleInfractionSearchPagination(data: {
    interaction: ButtonInteraction<'cached'>;
    options: PageOptions;
  }) {
    const { interaction, options } = data;

    const [embed] = interaction.message.embeds;

    // Format: "User ID: {target_id}"
    const targetId = embed.footer!.text.split(': ')[1];
    const target = await client.users.fetch(targetId).catch(() => null);

    if (!target) {
      return {
        error: 'The target user could not be found.',
        temporary: true
      };
    }

    const buttons = interaction.message.components[0].components as ButtonComponent[];
    // Get the middle component
    const pageCountButton = buttons[Math.floor(buttons.length / 2)];
    // Format: "{current_page} / {total_pages}"
    const [strCurrentPage, strTotalPages] = pageCountButton.label!.split(' / ');
    const page = InfractionSearchPaginationComponent.parsePageOptions(
      options,
      parseInt(strCurrentPage),
      parseInt(strTotalPages)
    );
    // Format: "{filter} ..."
    let filter: InfractionFlag | null = embed.author!.name.split(' ')[0] as InfractionFlag;

    if (!(filter in InfractionFlag)) {
      filter = null;
    }

    return InfractionManager.searchInfractions({
      guildId: interaction.guildId,
      controllerId: interaction.user.id,
      target,
      page,
      filter
    });
  }

  public static parsePageOptions(options: PageOptions, currentPage: number, totalPages: number): number {
    if ('pageOffset' in options) {
      return currentPage + options.pageOffset;
    } else {
      return options.page < 1 ? totalPages + options.page : options.page;
    }
  }
}

export type PageOptions = Record<'pageOffset', number> | Record<'page', number>;
