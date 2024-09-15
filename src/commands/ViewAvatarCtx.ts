import { ApplicationCommandType, Colors, UserContextMenuCommandInteraction } from 'discord.js';

import Command, { CommandCategory } from '@/managers/commands/Command';

export default class ViewAvatar extends Command<UserContextMenuCommandInteraction> {
  constructor() {
    super({
      category: CommandCategory.Utility,
      allowInDms: true,
      data: {
        name: 'View Avatar',
        type: ApplicationCommandType.User
      }
    });
  }

  async execute(interaction: UserContextMenuCommandInteraction) {
    const target = interaction.targetUser;
    return interaction.reply({
      embeds: [
        {
          author: { name: `${target.username}'s Avatar`, icon_url: target.displayAvatarURL() },
          description: `[Avatar URL](${target.displayAvatarURL({ size: 4096 })})`,
          image: { url: target.displayAvatarURL({ size: 4096 }) },
          color: Colors.NotQuiteBlack,
          footer: {
            text: `User ID: ${target.id}`
          }
        }
      ],
      ephemeral: true
    });
  }
}
