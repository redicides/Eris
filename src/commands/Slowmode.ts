import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  PermissionFlagsBits
} from 'discord.js';

import ms from 'ms';

import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Slowmode extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '[+|-time]',
      requiredPermissions: PermissionFlagsBits.ManageChannels,
      data: {
        name: 'slowmode',
        description: 'Set or view the slowmode of a channel.',
        defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'time',
            description: 'The time to set the slowmode to.',
            type: ApplicationCommandOptionType.String,
            required: false
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    if (!interaction.channel?.isTextBased()) {
      return {
        error: `This command cannot be used here.`
      };
    }

    let time = interaction.options.getString('time', false);
    const current = interaction.channel.rateLimitPerUser;
    const parsedSlowmode = current ? ms(current * 1000, { long: true }).replace(/(\d+)/g, '**$1**') : '**0** seconds';

    if (!time) {
      return {
        content: `The current slowmode is set to ${parsedSlowmode}.`
      };
    }

    let method = 'set';

    if (time.startsWith('+') || time.startsWith('-')) {
      method = time.startsWith('+') ? 'add' : 'remove';
      time = time.slice(1);
    }

    let slowmode = +time || Math.floor(ms(time) / 1000);

    if (isNaN(slowmode)) {
      return {
        error: `The time provided is invalid.`,
        temporary: true
      };
    }

    switch (method) {
      case 'add':
        slowmode += current ?? 0;
        break;
      case 'remove':
        slowmode = (current ?? 0) - slowmode;
        break;
      case 'set':
        slowmode = slowmode;
    }

    if (slowmode !== 0 && slowmode < 1) slowmode = 0;
    if (slowmode > 21600) slowmode = 21600;
    if (slowmode === current) {
      return {
        error: `The slowmode is already set to ${parsedSlowmode}.`,
        temporary: true
      };
    }

    const set = await interaction.channel
      .setRateLimitPerUser(slowmode, `Slowmode set by @${interaction.user.username} (${interaction.user.id})`)
      .catch(() => null);

    if (!set) {
      return {
        error: `Failed to set the slowmode.`,
        temporary: true
      };
    }

    return slowmode === 0
      ? { content: `Slowmode has been turned off.`, temporary: true }
      : {
          content: `Slowmode has been set to ${ms(slowmode * 1000, { long: true })
            .replace(/(\d+)/g, '`$1`')
            .replace('ms', 'seconds')}.`,
          temporary: true
        };
  }
}
