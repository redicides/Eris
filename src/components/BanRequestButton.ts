import { ButtonInteraction, Colors, EmbedBuilder, EmbedData } from 'discord.js';

import { hasPermission, userMentionWithId } from '@utils/index';
import { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';
import { RequestUtils } from '@utils/Requests';
import { GuildConfig } from '@utils/Types';
import { MessageKeys } from '@utils/Keys';

import Component from '@managers/components/Component';

export default class BanRequestButtonComponent extends Component {
  constructor() {
    super({ matches: /^ban-request-(accept|deny|disregard)$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>, config: GuildConfig) {
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny' | 'disregard';

    if (!hasPermission(interaction.member, config, 'Manage_Ban_Requests')) {
      return {
        error: MessageKeys.Errors.MissingUserPermission('Manage_Ban_Requests', 'manage ban requests'),
        temporary: true
      };
    }

    const request = await this.prisma.banRequest.findUnique({
      where: { id: interaction.message.id, guild_id: interaction.guildId }
    });

    if (!request) {
      setTimeout(async () => {
        await interaction.message.delete().catch(() => null);
      }, 7000);

      return {
        error: 'Failed to fetch the related ban request. I will attempt to delete the alert in **7 seconds**.',
        temporary: true
      };
    }

    if (request.resolved_by) {
      setTimeout(async () => {
        await interaction.message.delete().catch(() => null);
      }, 7500);

      return {
        error: `This request has already been resolved by ${userMentionWithId(
          request.resolved_by
        )}. I will attempt to delete the alert in **7 seconds**.`,
        temporary: true
      };
    }

    const key = `ban_requests_require_${action}_reason` as keyof typeof config;

    if (action === 'disregard') {
      await this.prisma.banRequest.update({
        where: { id: request.id },
        data: { resolved_by: interaction.user.id, resolved_at: Date.now(), status: 'Disregarded' }
      });

      const log = new EmbedBuilder(interaction.message.embeds[0] as EmbedData)
        .setColor(Colors.NotQuiteBlack)
        .setAuthor({ name: `Mute Request` })
        .setFooter({ text: `Request ID: #${request.id}` })
        .setTimestamp();

      await RequestUtils.sendLog({
        config,
        embed: log,
        userId: interaction.user.id,
        action: 'Disregarded',
        reason: DEFAULT_INFRACTION_REASON
      });

      await interaction.message.delete().catch(() => null);

      return {
        content: 'The ban request has been disregarded.',
        ephemeral: true
      };
    } else {
      if (config[key]) {
        await interaction.showModal(RequestUtils.buildModal({ requestId: request.id, action, type: 'ban' }));
        return null;
      }

      return RequestUtils.handleBanRequestAction({
        interaction,
        config,
        request,
        action,
        reason: DEFAULT_INFRACTION_REASON
      });
    }
  }
}
