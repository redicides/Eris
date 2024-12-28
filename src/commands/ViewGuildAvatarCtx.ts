import { ApplicationCommandType, Colors, EmbedBuilder, UserContextMenuCommandInteraction } from 'discord.js';

import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@eris/Command';

export default class ViewServerAvatar extends Command {
  constructor() {
    super({
      category: CommandCategory.Context,
      data: {
        name: 'View Server Avatar',
        type: ApplicationCommandType.User
      }
    });
  }

  async execute(interaction: UserContextMenuCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const target = interaction.targetMember;

    if (!target) {
      return {
        error: `${interaction.targetUser} is not a member of this server.`,
        temporary: true
      };
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${target.user.username}'s Avatar`, iconURL: target.displayAvatarURL() })
      .setColor(Colors.NotQuiteBlack)
      .setDescription(
        `[Server Avatar URL](${target.displayAvatarURL({
          size: 4096
        })})\n[Global Avatar URL](${interaction.targetUser.displayAvatarURL({ size: 4096 })})`
      )
      .setImage(target.displayAvatarURL({ size: 4096 }))
      .setFooter({ text: `User ID: ${target.id}` });

    return { embeds: [embed] };
  }
}
