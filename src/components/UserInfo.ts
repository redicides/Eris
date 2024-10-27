import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Colors, EmbedBuilder } from 'discord.js';

import { InteractionReplyData } from '@utils/Types';

import UserInfo from '@/commands/UserInfo';
import Component from '@managers/components/Component';

export default class UserInfoComponent extends Component {
  constructor() {
    super({ matches: /^user-info-\d{17,19}$/m });
  }

  async execute(interaction: ButtonInteraction<'cached'>): Promise<InteractionReplyData> {
    const targetId = interaction.customId.split('-')[2];

    const member = await interaction.guild.members.fetch(targetId).catch(() => null);
    const target = member?.user ?? (await interaction.client.users.fetch(targetId).catch(() => null));

    if (!target) {
      return {
        error: 'The target user could not be found.',
        temporary: true
      };
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
      .setColor(Colors.NotQuiteBlack)
      .setThumbnail(target.displayAvatarURL())
      .setFields(UserInfo.formatFields(target, member))
      .setFooter({ text: `User ID: ${target.id}` });

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    const infractionsButton = new ButtonBuilder()
      .setLabel('Search Infractions')
      .setCustomId(`infraction-search-${target.id}`)
      .setStyle(ButtonStyle.Secondary);

    components.push(new ActionRowBuilder<ButtonBuilder>().setComponents(infractionsButton));

    return {
      embeds: [embed],
      components,
      ephemeral: true
    };
  }
}
