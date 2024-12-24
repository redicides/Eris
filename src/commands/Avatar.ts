import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';

import { MessageKeys } from '@utils/Keys';
import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@terabyte/Command';

export default class Avatar extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: `[target]`,
      data: {
        name: 'avatar',
        description: 'Get the avatar of a user.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'target',
            description: 'The target user.',
            type: ApplicationCommandOptionType.User,
            required: false
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const target = interaction.options.getUser('target', false) ?? interaction.user;

    if (!target) {
      return {
        error: MessageKeys.Errors.TargetNotFound,
        temporary: true
      };
    }

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setAuthor({ name: `@${target.username}'s Avatar`, iconURL: target.displayAvatarURL() })
      .setDescription(
        `[Global Avatar URL](${target.displayAvatarURL({ size: 4096 })})${
          targetMember ? `\n[Server Avatar URL](${targetMember.displayAvatarURL({ size: 4096 })})` : ''
        }`
      )
      .setImage(target.displayAvatarURL({ size: 4096 }))
      .setFooter({ text: `User ID: ${target.id}` });

    return {
      embeds: [embed]
    };
  }
}
