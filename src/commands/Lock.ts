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
import { PermissionEnum } from '@prisma/client';

import { MessageKeys } from '@utils/Keys';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { capitalize, elipsify, hasPermission } from '@utils/index';
import { DEFAULT_INFRACTION_REASON, INFRACTION_COLORS } from '@managers/database/InfractionManager';

import Command, { CommandCategory } from '@managers/commands/Command';

export default class Lock extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '[channel] [reason] [override-notification]',
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
    config: GuildConfig,
    ephemeral: boolean
  ): Promise<InteractionReplyData> {
    const rawReason = interaction.options.getString('reason', false);
    const notifyChannel = hasPermission(interaction.member, config, PermissionEnum.OverrideLockdownNotificatons)
      ? (interaction.options.getBoolean('send-channel-notification', false) ?? config.lockdownNotify)
      : config.lockdownNotify;

    if (!hasPermission(interaction.member, config, 'LockChannels')) {
      return {
        error: MessageKeys.Errors.MissingUserPermission('LockChannels', 'lock a channel'),
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
          if (!override.allow.has(config.lockdownOverrides)) return false;

          return true;
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
      everyoneOverrideDeny + (config.lockdownOverrides - (everyoneOverrideDeny & config.lockdownOverrides));

    if (updatedOverride === everyoneOverrideDeny) {
      return {
        error: `${capitalize(parsedChannelStr)} is already locked.`,
        temporary: true
      };
    }

    if (!rawReason && config.lockdownRequireReason) {
      return {
        error: `A reason is required to lock ${parsedChannelStr}.`,
        temporary: true
      };
    }

    const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

    await interaction.deferReply({ ephemeral });

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

    if ((everyoneOverrideAllow & config.lockdownOverrides) !== 0n) {
      const lockData = {
        id: channel.id,
        guildId: interaction.guildId,
        allow: everyoneOverrideAllow & config.lockdownOverrides
      };

      await this.prisma.channelLock.upsert({
        where: { id: channel.id, guildId: interaction.guildId },
        create: lockData,
        update: lockData
      });
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: this.client.user!.username, iconURL: this.client.user!.displayAvatarURL() })
      .setColor(INFRACTION_COLORS.Mute)
      .setTitle('Channel Locked')
      .setDescription(`This channel has been locked${config.lockdownDisplayExecutor ? ` by ${interaction.user}` : ''}.`)
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
