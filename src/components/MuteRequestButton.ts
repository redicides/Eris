import { ButtonInteraction, Colors, EmbedBuilder, EmbedData } from 'discord.js';

import { hasPermission, userMentionWithId } from '@utils/index';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { DefaultInfractionReason } from '@managers/database/InfractionManager';
import { RequestUtils } from '@utils/Requests';
import { UserPermission } from '@utils/Enums';
import { MessageKeys } from '@utils/Keys';

import Component from '@terabyte/Component';

export default class MuteRequestButton extends Component {
  constructor() {
    super({ matches: /^mute-request-(accept|deny|disregard)$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData | null> {
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny' | 'disregard';

    if (!hasPermission(interaction.member, config, UserPermission.ManageMuteRequests)) {
      return {
        error: MessageKeys.Errors.MissingUserPermission(UserPermission.ManageMuteRequests, 'manage mute requests'),
        temporary: true
      };
    }

    const request = await this.prisma.muteRequest.findUnique({
      where: { id: interaction.message.id }
    });

    if (!request) {
      setTimeout(async () => {
        await interaction.message.delete().catch(() => null);
      }, 7000);

      return {
        error: 'Failed to fetch the related mute request. I will attempt to delete the alert in **7 seconds**.',
        temporary: true
      };
    }

    if (request.resolved_by) {
      setTimeout(async () => {
        await interaction.message.delete().catch(() => null);
      }, 7500);

      return {
        error: `This request has already been ${
          request.status === 'AutoResolved'
            ? 'automatically resolved due to a ban'
            : `resolved by ${userMentionWithId(request.resolved_by)}`
        }. I will attempt to delete the alert in **7 seconds**.`,
        temporary: true
      };
    }

    const key = `mute_requests_require_${action}_reason` as keyof typeof config;

    if (action === 'disregard') {
      await this.prisma.muteRequest.update({
        where: { id: request.id },
        data: { resolved_by: interaction.user.id, resolved_at: new Date(), status: 'Disregarded' }
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
        reason: DefaultInfractionReason
      });

      await interaction.message.delete().catch(() => null);

      return {
        content: 'Successfully disregarded the mute request.',
        temporary: true
      };
    } else {
      if (config[key]) {
        await interaction.showModal(RequestUtils.buildModal({ requestId: request.id, action, type: 'mute' }));
        return null;
      }

      return RequestUtils.handleMuteRequestAction({
        interaction,
        action,
        request,
        config,
        reason: null
      });
    }
  }
}
