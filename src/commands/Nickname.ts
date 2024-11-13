import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import { hierarchyCheck } from '@utils/index';
import { COMMON_CHARACTERS } from '@utils/Constants';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Nickname extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: ['set <target> [nickname]', 'censor <target>'],
      requiredPermissions: PermissionFlagsBits.ManageNicknames,
      data: {
        name: 'nickname',
        description: "Set or censor a member's nickname.",
        defaultMemberPermissions: PermissionFlagsBits.ManageNicknames,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: NicknameSubcommand.Set,
            description: "Set a member's nickname or reset it.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'target',
                description: 'The target member.',
                type: ApplicationCommandOptionType.User,
                required: true
              },
              {
                name: 'nickname',
                description: 'The nickname to set.',
                type: ApplicationCommandOptionType.String,
                required: false,
                min_length: 3,
                max_length: 32
              }
            ]
          },
          {
            name: NicknameSubcommand.Censor,
            description: `Censor a member's nickname.`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'target',
                description: 'The target member.',
                type: ApplicationCommandOptionType.User,
                required: true
              }
            ]
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>) {
    const subcommand = interaction.options.getSubcommand() as NicknameSubcommand;

    switch (subcommand) {
      case NicknameSubcommand.Set: {
        const target = interaction.options.getMember('target');
        const nickname = interaction.options.getString('nickname', false);

        if (!target) {
          return {
            error: 'The target member could not be found.',
            temporary: true
          };
        }

        if (target.id === interaction.user.id) {
          return {
            error: 'You cannot set your own nickname.',
            temporary: true
          };
        }

        if (target.id === this.client.user!.id) {
          return {
            error: 'I cannot set my own nickname.',
            temporary: true
          };
        }

        if (!hierarchyCheck(interaction.member!, target)) {
          return {
            error: 'You cannot set the nickname of a member with higher or equal roles than you.',
            temporary: true
          };
        }

        if (!hierarchyCheck(interaction.guild.members.me!, target)) {
          return {
            error: 'I cannot set the nickname of a member with higher or equal roles than me.',
            temporary: true
          };
        }

        if (!nickname && !target.nickname) {
          return {
            error: `${target} does not have a nickname.`,
            temporary: true
          };
        }

        if (nickname && target.nickname === nickname) {
          return {
            error: `${target}'s nickname is already set to \`${nickname}\`.`,
            temporary: true
          };
        }

        const set = await target
          .setNickname(nickname, `Nickname set by @${interaction.user.username} (${interaction.user.id})`)
          .catch(() => null);

        return set
          ? {
              content: `${target}'s nickname has been ${nickname ? `set to \`${nickname}\`` : 'reset'}.`,
              temporary: true
            }
          : { error: `Failed to set ${target}'s nickname.`, temporary: true };
      }

      case NicknameSubcommand.Censor: {
        const target = interaction.options.getMember('target');

        if (!target) {
          return {
            error: 'The target member could not be found.',
            temporary: true
          };
        }

        if (target.id === interaction.user.id) {
          return {
            error: 'You cannot censor your own nickname.',
            temporary: true
          };
        }

        if (target.id === this.client.user!.id) {
          return {
            error: 'I cannot censor my own nickname.',
            temporary: true
          };
        }

        if (!hierarchyCheck(interaction.member!, target)) {
          return {
            error: 'You cannot censor the nickname of a member with higher or equal roles than you.',
            temporary: true
          };
        }

        if (!hierarchyCheck(interaction.guild.members.me!, target)) {
          return {
            error: 'I cannot censor the nickname of a member with higher or equal roles than me.',
            temporary: true
          };
        }

        if (target.nickname && Nickname._censorRegex.test(target.nickname)) {
          return {
            error: `${target}'s nickname is already censored.`,
            temporary: true
          };
        }

        let code = '';

        for (let i = 0; i !== 8; ++i) {
          code += COMMON_CHARACTERS[Math.floor(Math.random() * COMMON_CHARACTERS.length)];
        }

        const set = await target
          .setNickname(`User ${code}`, `Nickname censored by @${interaction.user.username} (${interaction.user.id})`)
          .catch(() => null);

        return set
          ? { content: `${target}'s nickname has been censored (\`${code}\`).`, temporary: true }
          : { error: `Failed to censor ${target}'s nickname.`, temporary: true };
      }
    }
  }

  private static readonly _censorRegex = /^User [A-Za-z0-9]{8}$/;
}

enum NicknameSubcommand {
  Set = 'set',
  Censor = 'censor'
}
