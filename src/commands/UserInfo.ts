import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  EmbedField,
  GuildMember,
  time,
  User
} from 'discord.js';

import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@terabyte/Command';

export default class UserInfo extends Command {
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
                required: true
              }
            ]
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const member = interaction.options.getMember('target');
    const user = member?.user ?? interaction.options.getUser('target', true);

    const embed = new EmbedBuilder()
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setColor(Colors.NotQuiteBlack)
      .setThumbnail(user.displayAvatarURL())
      .setFields(UserInfo.formatFields(user, member))
      .setFooter({ text: `User ID: ${user.id}` });

    const infractionSearchButton = new ButtonBuilder()
      .setLabel('Search Infractions')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`infraction-search-${user.id}`);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(infractionSearchButton);

    return { embeds: [embed], components: [actionRow] };
  }

  /**
   * Format the fields for the embed
   */

  static formatFields(user: User, member: GuildMember | null): EmbedField[] {
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
