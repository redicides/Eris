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

import { MessageKeys } from '@utils/Keys';
import { UserPermission } from '@utils/Enums';
import { elipsify, hasPermission, isEphemeralReply } from '@utils/index';
import { DefaultInfractionReason } from '@managers/database/InfractionManager';
import { GuildConfig, InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Unlock extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '[channel] [reason] [send-channel-notification]',
      requiredPermissions: PermissionFlagsBits.ManageChannels,
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
            name: 'send-channel-notification',
            description: 'Whether to send a notification to the channel.',
            type: ApplicationCommandOptionType.Boolean,
            required: false
          }
        ]
      }
    });
  }

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData> {
    const rawReason = interaction.options.getString('reason', false);
    const notifyChannel = hasPermission(interaction.member, config, UserPermission.OverrideLockdownNotificatons)
      ? (interaction.options.getBoolean('send-channel-notification', false) ?? config.lockdown_notify)
      : config.lockdown_notify;

    if (!hasPermission(interaction.member, config, UserPermission.UnlockChannels)) {
      return {
        error: MessageKeys.Errors.MissingUserPermission(UserPermission.UnlockChannels, 'unlock a channel'),
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
          return override.allow.has(config.lockdown_overrides);
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
          where: { id: channel.id, guild_id: interaction.guildId }
        })
      )?.overwrites ?? 0n;

    const parsedChannelStr = channel === interaction.channel ? 'this channel' : `that channel`;

    const everyoneOverride = channel.permissionOverwrites.cache.get(interaction.guildId);
    const everyoneOverrideDeny = everyoneOverride?.deny.bitfield ?? 0n;
    const everyoneOverrideAllow = everyoneOverride?.allow.bitfield ?? 0n;

    const updatedDenyOverride = everyoneOverrideDeny - (everyoneOverrideDeny & config.lockdown_overrides);
    const updatedAllowOverride =
      everyoneOverrideAllow + (lockAllowOverrides - (everyoneOverrideAllow & lockAllowOverrides));

    if (updatedDenyOverride === everyoneOverrideDeny) {
      return {
        error: `${parsedChannelStr} is already unlocked.`,
        temporary: true
      };
    }

    if (!rawReason && config.lockdown_require_reason) {
      return {
        error: `A reason is required to unlock ${parsedChannelStr}.`,
        temporary: true
      };
    }

    const reason = rawReason ?? DefaultInfractionReason;

    await interaction.deferReply({ ephemeral: isEphemeralReply(interaction, config) });

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
        `This channel has been unlocked${config.lockdown_display_executor ? ` by ${interaction.user}` : ''}.`
      )
      .setFields([{ name: 'Reason', value: reason }])
      .setTimestamp();

    if (notifyChannel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    return {
      content: `Successfully unlocked ${parsedChannelStr}.`.replaceAll('that channel', `${channel}`)
    };
  }
}
