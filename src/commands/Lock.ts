import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ForumChannel,
  PermissionFlagsBits,
  TextChannel,
  VoiceChannel
} from 'discord.js';

import { MessageKeys } from '@utils/Keys';
import { UserPermission } from '@utils/Enums';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { capitalize, elipsify, hasPermission, isEphemeralReply } from '@utils/index';
import { DefaultInfractionReason, InfractionColors } from '@managers/database/InfractionManager';

import Command, { CommandCategory } from '@managers/commands/Command';
import DatabaseManager from '@managers/database/DatabaseManager';

export default class Lock extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '[channel] [reason] [send-channel-notification]',
      requiredPermissions: PermissionFlagsBits.ManageChannels,
      data: {
        name: 'lock',
        description: 'Lock a channel.',
        defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'channel',
            description: 'The channel to lock.',
            type: ApplicationCommandOptionType.Channel,
            required: false,
            channelTypes: [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum]
          },
          {
            name: 'reason',
            description: 'The reason for locking the channel.',
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

    if (!hasPermission(interaction.member, config, UserPermission.LockChannels)) {
      return {
        error: MessageKeys.Errors.MissingUserPermission(UserPermission.LockChannels, 'lock a channel'),
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
          error: `I need the 'Manage Channels' permission to lock this channel.`,
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
          error: `I cannot lock this channel as it does not have any overrides for me to deny and I lack the \`Administrator\` permission.`,
          temporary: true
        };
    }

    const parsedChannelStr = channel === interaction.channel ? 'this channel' : `that channel`;

    const everyoneOverride = channel.permissionOverwrites.cache.get(interaction.guildId);
    const everyoneOverrideDeny = everyoneOverride?.deny.bitfield ?? 0n;
    const everyoneOverrideAllow = everyoneOverride?.allow.bitfield ?? 0n;

    const updatedOverride =
      everyoneOverrideDeny + (config.lockdown_overrides - (everyoneOverrideDeny & config.lockdown_overrides));

    if (updatedOverride === everyoneOverrideDeny) {
      return {
        error: `${capitalize(parsedChannelStr)} is already locked.`,
        temporary: true
      };
    }

    if (!rawReason && config.lockdown_require_reason) {
      return {
        error: `A reason is required to lock ${parsedChannelStr}.`,
        temporary: true
      };
    }

    const reason = rawReason ?? DefaultInfractionReason;

    await interaction.deferReply({ ephemeral: isEphemeralReply(interaction, config) });

    await channel.permissionOverwrites.set(
      [
        ...channel.permissionOverwrites.cache.values(),
        {
          id: interaction.guildId,
          deny: updatedOverride
        }
      ],
      elipsify(`Locked by @${interaction.user.username} (${interaction.user.id}) - ${reason}`, 128)
    );

    if ((everyoneOverrideAllow & config.lockdown_overrides) !== 0n) {
      await DatabaseManager.upsertChannelLockEntry({
        id: channel.id,
        guild_id: interaction.guildId,
        overwrites: everyoneOverrideAllow & config.lockdown_overrides
      });
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: this.client.user!.username, iconURL: this.client.user!.displayAvatarURL() })
      .setColor(InfractionColors.Mute)
      .setTitle('Channel Locked')
      .setDescription(
        `This channel has been locked${config.lockdown_display_executor ? ` by ${interaction.user}` : ''}.`
      )
      .setFields([{ name: 'Reason', value: reason }])
      .setTimestamp();

    if (notifyChannel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    return {
      content: `Successfully locked ${parsedChannelStr}.`.replaceAll('that channel', `${channel}`)
    };
  }
}
