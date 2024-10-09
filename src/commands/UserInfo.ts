import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  EmbedField,
  GuildMember,
  time,
  User
} from 'discord.js';

import { InteractionReplyData } from '@/utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Userinfo extends Command<ChatInputCommandInteraction<'cached'>> {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '[target]',
      data: {
        name: 'user',
        description: 'User related commands.',
        options: [
          {
            name: 'info',
            description: 'Get information about a user.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'target',
                description: 'The user to get information about.',
                type: ApplicationCommandOptionType.User,
                required: false
              }
            ]
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const user = interaction.options.getUser('target') ?? interaction.user;
    const member = interaction.options.getMember('user') ?? interaction.member;

    const embed = new EmbedBuilder()
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setColor(Colors.NotQuiteBlack)
      .setThumbnail(user.displayAvatarURL())
      .setFields(this._formatFields(user, member))
      .setFooter({ text: `User ID: ${user.id}` });

    return { embeds: [embed] };
  }

  /**
   * Format the fields for the embed
   */

  private _formatFields(user: User, member: GuildMember | null): EmbedField[] {
    const fields: EmbedField[] = [];

    fields.push({
      name: 'Created',
      value: time(user.createdAt, 'R'),
      inline: true
    });

    if (member && member.joinedAt)
      fields.push({
        name: 'Joined',
        value: time(member.joinedAt, 'R'),
        inline: true
      });

    fields.push({
      name: `Avatar URL${member ? 's' : ''}`,
      value: `[Global](${user.displayAvatarURL()})${member ? ` / [Server](${member.displayAvatarURL()})` : ``}`,
      inline: true
    });

    return fields;
  }
}
