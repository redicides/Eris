import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel
} from 'discord.js';

import { InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Purge extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '<amount> [channel] [target]',
      requiredPermissions: PermissionFlagsBits.ManageMessages,
      data: {
        name: 'purge',
        description: 'Delete messages in a channel.',
        defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'amount',
            description: 'The amount of messages to delete.',
            type: ApplicationCommandOptionType.Integer,
            min_value: 1,
            max_value: 100,
            required: true
          },
          {
            name: 'channel',
            description: 'The channel to delete messages from.',
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildText],
            required: false
          },
          {
            name: 'target',
            description: 'The target user to delete messages from.',
            type: ApplicationCommandOptionType.User,
            required: false
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const amount = interaction.options.getInteger('amount', true);
    const target = interaction.options.getUser('target', false);

    let channel = interaction.options.getChannel('channel', false) as TextChannel | null;
    let deleted = 0;

    if (!channel) {
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        return {
          error: `This command must be used in a text channel or a channel must be specified in the 'channel' option.`,
          temporary: true
        };
      }

      channel = interaction.channel as TextChannel;
    }

    if (!channel.permissionsFor(interaction.member).has(PermissionFlagsBits.ManageMessages)) {
      return {
        error: `You do not have permission to delete messages in this channel.`,
        temporary: true
      };
    }

    if (!channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageMessages)) {
      return {
        error: `I do not have permission to delete messages in this channel.`,
        temporary: true
      };
    }

    // Force ephemeral reply to prevent it from being deleted
    await interaction.deferReply({ ephemeral: true });

    if (target) {
      let targetDeleted = 0;

      for (let i = 0; i < 3; i++) {
        const targetMessages = await channel.messages.fetch({ limit: 100 }).then(messages => {
          if (messages.size === 0) return null;

          const filtered = [...messages.values()].filter(msg => msg.author.id === target.id).slice(0, amount - deleted);
          if (filtered.length === 0) return null;

          return filtered;
        });

        if (!targetMessages) {
          break;
        }

        deleted = (await channel.bulkDelete(targetMessages, true)).size;
        if (deleted === 0) {
          break;
        }

        targetDeleted += deleted;
      }

      return targetDeleted === 0
        ? {
            error: `No messages from ${target} were found in ${channel}.`,
            temporary: true
          }
        : {
            content: `Successfully deleted **${targetDeleted}** messages in ${channel} from ${target}.`,
            temporary: true
          };
    }

    const messages = await channel.messages.fetch({ limit: amount });
    deleted = (await channel.bulkDelete(messages, true)).size;

    return deleted === 0
      ? { error: `No messages to delete were found in ${channel}.`, temporary: true }
      : { content: `Successfully deleted **${deleted}** messages in ${channel}.`, temporary: true };
  }
}
