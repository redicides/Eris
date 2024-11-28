import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  ForumChannel,
  PermissionFlagsBits,
  TextChannel,
  VoiceChannel
} from 'discord.js';

import { elipsify, hasPermission } from '@utils/index';
import { DEFAULT_INFRACTION_REASON } from '@managers/database/InfractionManager';
import { GuildConfig, InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Unlock extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '[channel] [reason] [override-notification]',
      data: {
        name: 'unlock',
        description: 'Unlock a channel.',
        defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'channel',
            description: 'The channel to unlock.',
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channelTypes: [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum]
          },
          {
            name: 'reason',
            description: 'The reason for unlocking the channel.',
            type: ApplicationCommandOptionType.String,
            required: false,
            max_length: 1024
          },
          {
            name: 'override-notification',
            description: 'Whether to override the channel notification setting.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
          }
        ]
      }
    });
  }

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig,
    ephemeral: boolean
  ): Promise<InteractionReplyData> {
    const rawReason = interaction.options.getString('reason', false);
    const overrideNotification = interaction.options.getBoolean('override-notification', false) ?? false;

    if (!hasPermission(interaction.member, config, 'UnlockChannels')) {
      return {
        error: `You do not have permission to use this command.`,
        temporary: true
      };
    }

    let channel = interaction.options.getChannel('channel', false) as TextChannel | VoiceChannel | ForumChannel | null;

    if (!channel) {
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        return {
          error: `This command must be used in a text channel or a channel must be specified in the 'channel' option.`,
          temporary: true
        };
      }

      channel = interaction.channel as TextChannel | VoiceChannel | ForumChannel;
    }

    if (!interaction.appPermissions.has(PermissionFlagsBits.Administrator)) {
      if (!channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageChannels)) {
        return {
          error: `I need the 'Manage Channels' permission to unlock this channel.`,
          temporary: true
        };
      }

      if (
        !channel.permissionOverwrites.cache.some(override => {
          if (override.id === interaction.guildId) return false;
          if (!override.allow.has(config.lockdownOverrides)) return false;

          return true;
        })
      )
        return {
          error: `I cannot unlock this channel as it does not have any overrides for me to allow.`,
          temporary: true
        };
    }

    const lockAllowOverrides =
      (
        await this.prisma.channelLock.findUnique({
          where: { id: channel.id }
        })
      )?.allow ?? 0n;

    const parsedChannelStr = channel === interaction.channel ? 'this channel' : `that channel`;

    const everyoneOverride = channel.permissionOverwrites.cache.get(interaction.guildId);
    const everyoneOverrideDeny = everyoneOverride?.deny.bitfield ?? 0n;
    const everyoneOverrideAllow = everyoneOverride?.allow.bitfield ?? 0n;

    const updatedDenyOverride = everyoneOverrideDeny - (everyoneOverrideDeny & config.lockdownOverrides);
    const updatedAllowOverride =
      everyoneOverrideAllow + (lockAllowOverrides - (everyoneOverrideAllow & lockAllowOverrides));

    if (updatedDenyOverride === everyoneOverrideDeny) {
      return {
        error: `${parsedChannelStr} is already unlocked.`,
        temporary: true
      };
    }

    if (!rawReason && !config.lockdownRequireReason) {
      return {
        error: `A reason is required to unlock ${parsedChannelStr}.`,
        temporary: true
      };
    }

    const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

    await interaction.deferReply({ ephemeral });

    if (lockAllowOverrides !== 0n) {
      await this.prisma.channelLock.delete({ where: { id: channel.id } });
    }

    await channel.permissionOverwrites.set(
      [
        ...channel.permissionOverwrites.cache.values(),
        {
          id: interaction.guildId,
          allow: updatedAllowOverride,
          deny: updatedDenyOverride
        }
      ],
      elipsify(`Unlocked by @${interaction.user.username} (${interaction.user.id}) - ${reason}`, 128)
    );

    const embed = new EmbedBuilder()
      .setAuthor({ name: this.client.user!.username, iconURL: this.client.user!.displayAvatarURL() })
      .setColor(Colors.Green)
      .setTitle('Channel Unlocked')
      .setDescription(
        `This channel has been unlocked${config.lockdownDisplayExecutor ? ` by ${interaction.user}` : ''}.`
      )
      .setFields([{ name: 'Reason', value: reason }])
      .setTimestamp();

    if (
      config.lockdownNotify &&
      (!overrideNotification ||
        (overrideNotification && !hasPermission(interaction.member, config, 'OverrideLockdownNotificatons'))) &&
      channel.isTextBased()
    ) {
      await channel.send({ embeds: [embed] }).catch(() => {
      });
    }

    return {
      content: `Successfully unlocked ${parsedChannelStr}.`.replaceAll('that channel', `${channel}`)
    };
  }
}
