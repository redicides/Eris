import { ApplicationCommandType, Colors, UserContextMenuCommandInteraction } from 'discord.js';

import Command, { CommandCategory } from '@/managers/commands/Command';

export default class ViewGuildAvatar extends Command<UserContextMenuCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Utility,
      data: {
        name: 'View Guild Avatar',
        type: ApplicationCommandType.User
      }
    });
  }

  async execute(interaction: UserContextMenuCommandInteraction<'cached'>) {
    const target = await interaction.guild.members.fetch(interaction.targetId);
    if (!target) return this.error(interaction, `Could not find the member "${interaction.targetUser}" in this guild.`);

    return interaction.reply({
      embeds: [
        {
          author: { name: `${target.user.username}'s Avatar`, icon_url: target.displayAvatarURL() },
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
