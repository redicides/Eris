import { ApplicationCommandType, Colors, EmbedBuilder, UserContextMenuCommandInteraction } from 'discord.js';

import { InteractionReplyData } from '@/utils/types';

import ApplicationCommand, { CommandCategory } from '@managers/commands/ApplicationCommand';

export default class ViewAvatar extends ApplicationCommand<UserContextMenuCommandInteraction> {
  constructor() {
    super({
      category: CommandCategory.Utility,
      allowInDms: false,
      data: {
        name: 'View Global Avatar',
        type: ApplicationCommandType.User
      }
    });
  }

  async execute(interaction: UserContextMenuCommandInteraction): Promise<InteractionReplyData> {
    const target = interaction.targetUser;

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${target.username}'s Avatar`, iconURL: target.displayAvatarURL() })
      .setColor(Colors.NotQuiteBlack)
      .setDescription(`[Avatar URL](${target.displayAvatarURL({ size: 4096 })})`)
      .setImage(target.displayAvatarURL({ size: 4096 }))
      .setFooter({ text: `User ID: ${target.id}` });

    return { embeds: [embed] };
  }
}
