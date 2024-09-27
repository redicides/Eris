import { ApplicationCommandType, Colors, UserContextMenuCommandInteraction } from 'discord.js';

import ApplicationCommand, { CommandCategory } from '@managers/commands/ApplicationCommand';

export default class ViewServerAvatar extends ApplicationCommand<UserContextMenuCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Utility,
      data: {
        name: 'View Server Avatar',
        type: ApplicationCommandType.User
      }
    });
  }

  async execute(interaction: UserContextMenuCommandInteraction<'cached'>) {
    const target = await interaction.guild.members.fetch(interaction.targetId).catch(() => null);

    if (!target) {
      return this.error(interaction, `${interaction.targetUser} is not a member of this server.`);
    }

    return interaction.reply({
      embeds: [
        {
          author: { name: `${target.user.username}'s Avatar`, icon_url: target.displayAvatarURL() },
          description: `[Server Avatar URL](${target.displayAvatarURL({
            size: 4096
          })})\n[Global Avatar URL](${interaction.targetUser.displayAvatarURL({ size: 4096 })})`,
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