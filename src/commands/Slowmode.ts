import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel
} from 'discord.js';

import ms from 'ms';

import { MessageKeys } from '@utils/Keys';
import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@eris/Command';

export default class Slowmode extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '[+|-time] [channel]',
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
          },
          {
            name: 'channel',
            description: 'The channel to set the slowmode in.',
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channelTypes: [ChannelType.GuildText]
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const channel = Slowmode.resolveChannel(interaction);

    if (!channel) {
      return {
        error: `This command must be used in a text channel or a channel must be specified in the 'channel' option.`,
        temporary: true
      };
    }

    const time = interaction.options.getString('time', false);
    const current = channel.rateLimitPerUser;
    const parsedSlowmode = current ? ms(current * 1000, { long: true }).replace(/(\d+)/g, '**$1**') : '**0** seconds';
    const parsedChannel = channel === interaction.channel ? ' ' : ` in ${channel} `;

    if (!time) {
      return { content: `The current slowmode${parsedChannel}is set to ${parsedSlowmode}.` };
    }

    const method = time.startsWith('+') ? 'add' : time.startsWith('-') ? 'remove' : 'set';

    const cleanedTime = method !== 'set' ? time.slice(1) : time;
    const slowmode = Slowmode.calculateSlowmode(cleanedTime, current, method);

    if (isNaN(slowmode)) {
      return {
        error: MessageKeys.Errors.InvalidDuration(false).replaceAll('duraton', 'time'),
        temporary: true
      };
    }

    if (slowmode === current) {
      return {
        error: `The slowmode${parsedChannel}is already set to ${parsedSlowmode}.`,
        temporary: true
      };
    }

    const set = await channel
      .setRateLimitPerUser(slowmode, `Slowmode set by @${interaction.user.username} (${interaction.user.id})`)
      .catch(() => null);

    if (!set) {
      return {
        error: `The slowmode${parsedChannel}couldn't be updated. Please check my permissions and try again.`,
        temporary: true
      };
    }

    return slowmode === 0
      ? { content: `Slowmode${parsedChannel}has been turned off.`, temporary: true }
      : {
          content: `Slowmode${parsedChannel}has been set to ${ms(slowmode * 1000, { long: true })
            .replace(/(\d+)/g, '`$1`')
            .replace('ms', 'seconds')}.`,
          temporary: true
        };
  }

  private static resolveChannel(interaction: ChatInputCommandInteraction<'cached'>): TextChannel | null {
    let channel = interaction.options.getChannel('channel', false) as TextChannel | null;

    if (!channel) {
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        return null;
      }

      channel = interaction.channel as TextChannel;
    }

    return channel;
  }

  private static calculateSlowmode(time: string, current: number | null, method: string): number {
    let slowmode = +time || Math.floor(ms(time) / 1000);

    if (method === 'add') {
      slowmode += current ?? 0;
    } else if (method === 'remove') {
      slowmode = (current ?? 0) - slowmode;
    }

    return slowmode !== 0 && slowmode < 1 ? 0 : slowmode > 21600 ? 21600 : slowmode;
  }
}
