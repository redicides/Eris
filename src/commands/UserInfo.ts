import Command, { CommandCategory } from '@/managers/commands/Command';
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

  async execute(interaction: ChatInputCommandInteraction<'cached'>) {
    const target = interaction.options.getUser('target') ?? interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${target.username}`, iconURL: target.displayAvatarURL() })
      .setColor(Colors.NotQuiteBlack)
      .setThumbnail(target.displayAvatarURL())
      .setFields(this._formatFields(target, member))
      .setFooter({ text: `User ID: ${target.id}` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  /**
   * Format the fields for the embed
   */

  private _formatFields(user: User, member: GuildMember | null): EmbedField[] {
    const fields: EmbedField[] = [];

    fields.push({
      name: 'Created',
      value: time(user instanceof GuildMember ? user.user.createdAt : user.createdAt, 'R'),
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
      value: `[Global](${user.displayAvatarURL()})${member ? ` | [Server](${member.displayAvatarURL()})` : ``}`,
      inline: true
    });

    return fields;
  }
}
