import { ButtonInteraction, Colors, EmbedBuilder, EmbedData } from 'discord.js';

import { capitalize, hasPermission, userMentionWithId } from '@utils/index';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';
import { RequestUtils } from '@utils/Requests';

import Component from '@managers/components/Component';

export default class MuteRequestButton extends Component {
  constructor() {
    super({ matches: /^mute-request-(accept|deny|disregard)$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData | null> {
    const action = interaction.customId.split('-')[2] as 'accept' | 'deny' | 'disregard';

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

    if (request.resolvedBy) {
      setTimeout(async () => {
        await interaction.message.delete().catch(() => null);
      }, 7500);

      return {
        error: `This report has already been resolved by ${userMentionWithId(
          request.resolvedBy
        )}. I will attempt to delete the alert in **7 seconds**.`,
        temporary: true
      };
    }

    if (!hasPermission(interaction.member, config, 'ManageMuteRequests')) {
      return {
        error: 'You do not have permission to manage mute requests.',
        temporary: true
      };
    }

    const key = `muteRequestsRequire${capitalize(action)}Reason` as keyof typeof config;

    if (action === 'disregard') {
      await this.prisma.muteRequest.update({
        where: { id: request.id },
        data: { resolvedBy: interaction.user.id, resolvedAt: Date.now(), status: 'Disregarded' }
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
