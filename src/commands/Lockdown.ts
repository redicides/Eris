import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  TextChannel,
  VoiceChannel,
  ForumChannel,
  EmbedBuilder,
  channelMention
} from 'discord.js';

import { DEFAULT_INFRACTION_REASON, INFRACTION_COLORS } from '@managers/database/InfractionManager';
import { elipsify, hasPermission, isEphemeralReply, pluralize, sleep } from '@/utils';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { client, prisma } from '@/index';
import { MessageKeys } from '@utils/Keys';
import { UserPermission } from '@utils/Enums';

import Command, { CommandCategory } from '@managers/commands/Command';
import DatabaseManager from '@managers/database/DatabaseManager';

export default class Lockdown extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: ['start [reason] [notify-channels]', 'end [reason] [notify-channels]'],
      requiredPermissions: PermissionFlagsBits.ManageChannels,
      data: {
        name: 'lockdown',
        description: 'Start or end a server wide lock.',
        defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: LockdownSubcommand.Start,
            description: 'Start a server wide lock.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'reason',
                description: 'The reason for starting the lockdown.',
                type: ApplicationCommandOptionType.String,
                required: false,
                maxLength: 1024
              },
              {
                name: 'notify-channels',
                description: 'Toggle sending a notification to all channels.',
                type: ApplicationCommandOptionType.Boolean,
                required: false
              }
            ]
          },
          {
            name: LockdownSubcommand.End,
            description: 'End a server wide lock.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'reason',
                description: 'The reason for ending the lockdown.',
                type: ApplicationCommandOptionType.String,
                required: false,
                maxLength: 1024
              },
              {
                name: 'notify-channels',
                description: 'Toggle sending a notification to all channels.',
                type: ApplicationCommandOptionType.Boolean,
                required: false
              }
            ]
          }
        ]
      }
    });
  }

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData | null> {
    const subcommand = interaction.options.getSubcommand(true) as LockdownSubcommand;

    const rawReason = interaction.options.getString('reason', false);
    const notifyChannels = hasPermission(interaction.member, config, UserPermission.OverrideLockdownNotificatons)
      ? interaction.options.getBoolean('notify-channels', false) ?? config.lockdown_notify
      : config.lockdown_notify;

    if (subcommand === LockdownSubcommand.Start) {
      if (!hasPermission(interaction.member, config, UserPermission.StartLockdown)) {
        return {
          error: MessageKeys.Errors.MissingUserPermission(UserPermission.StartLockdown, 'start a lockdown'),
          temporary: true
        };
      }

      if (!rawReason && config.lockdown_require_reason) {
        return {
          error: MessageKeys.Errors.ReasonRequired('start a lockdown'),
          temporary: true
        };
      }

      const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

      return Lockdown.startLockdown({
        config,
        interaction,
        ephemeral: isEphemeralReply(interaction, config),
        reason,
        notifyChannels
      });
    } else {
      if (!hasPermission(interaction.member, config, UserPermission.EndLockdown)) {
        return {
          error: MessageKeys.Errors.MissingUserPermission(UserPermission.EndLockdown, 'end a lockdown'),
          temporary: true
        };
      }

      if (config.lockdown_require_reason && !rawReason) {
        return {
          error: MessageKeys.Errors.ReasonRequired('end a lockdown'),
          temporary: true
        };
      }

      const reason = rawReason ?? DEFAULT_INFRACTION_REASON;

      return Lockdown.endLockdown({
        interaction,
        ephemeral: isEphemeralReply(interaction, config),
        config,
        reason,
        notifyChannels
      });
    }
  }

  public static async startLockdown(data: {
    interaction: ChatInputCommandInteraction<'cached'>;
    ephemeral: boolean;
    config: GuildConfig;
    reason: string;
    notifyChannels: boolean;
  }): Promise<InteractionReplyData | null> {
    const { interaction, ephemeral, config, reason, notifyChannels } = data;
    const { lockdown_channels, lockdown_overrides, lockdown_display_executor } = config;

    if (!lockdown_channels.length) {
      return {
        error: 'No channels have been set up for lockdown. You can add them using the `/settings lockdown` command.',
        temporary: true
      };
    }

    let unknownChannels: string[] = [];
    let failedChannels: string[] = [];
    let lockedChannels: string[] = [];
    let alreadyLockedChannels: string[] = [];

    await interaction.reply({ content: `Starting lockdown...`, ephemeral });

    for (const channelId of lockdown_channels) {
      const channel = interaction.guild.channels.cache.get(channelId) as
        | TextChannel
        | VoiceChannel
        | ForumChannel
        | undefined;

      if (!channel) {
        unknownChannels.push(channelId);
        continue;
      }

      if (!interaction.appPermissions.has(PermissionFlagsBits.Administrator)) {
        if (!channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageChannels)) {
          failedChannels.push(channelId);
          continue;
        }

        if (
          !channel.permissionOverwrites.cache.some(override => {
            if (override.id === interaction.guildId) return false;
            return override.allow.has(lockdown_overrides);
          })
        ) {
          failedChannels.push(channelId);
          continue;
        }
      }

      const everyoneOverride = channel.permissionOverwrites.cache.get(interaction.guildId);
      const everyoneOverrideDeny = everyoneOverride?.deny.bitfield ?? 0n;
      const everyoneOverrideAllow = everyoneOverride?.allow.bitfield ?? 0n;

      const updatedOverride = everyoneOverrideDeny + (lockdown_overrides - (everyoneOverrideDeny & lockdown_overrides));

      if (everyoneOverrideDeny === updatedOverride) {
        alreadyLockedChannels.push(channelId);
        continue;
      }

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

      if ((everyoneOverrideAllow & lockdown_overrides) !== 0n) {
        await DatabaseManager.upsertChannelLockEntry({
          id: channel.id,
          guild_id: interaction.guildId,
          overwrites: everyoneOverrideAllow & lockdown_overrides
        });
      }

      if (channel.id !== interaction.channelId && channel.isTextBased() && notifyChannels) {
        await channel.send({ content: `This channel has been locked due to a server wide lockdown.` }).catch(() => {});
      }

      lockedChannels.push(channelId);

      // Pause for a second to prevent rate limiting
      await sleep(1000);
    }

    if (!lockedChannels.length) {
      await interaction.followUp({
        content: `I could not find any channels to lock.`,
        ephemeral
      });

      return null;
    }

    const map = Lockdown._parseChannelMap({ unknownChannels, failedChannels, alreadyLockedChannels });
    const embed = new EmbedBuilder()
      .setColor(INFRACTION_COLORS.Mute)
      .setAuthor({ name: client.user!.username, iconURL: client.user!.displayAvatarURL() })
      .setTitle('Server Locked')
      .setDescription(
        `This server has been put into lockdown${lockdown_display_executor ? ` by ${interaction.user}` : ''}.`
      )
      .setFields([{ name: 'Reason', value: reason }])
      .setTimestamp();

    await interaction.channel?.send({ embeds: [embed] }).catch(() => {});

    let content = `Successfully locked \`${lockedChannels.length}\` out of \`${lockdown_channels.length}\` ${pluralize(
      lockdown_channels.length,
      'channel'
    )}.\n`;

    if (map.unknown) content += `└ Channels I failed to fetch: ${map.unknown}\n`;
    if (map.failed) content += `└ Channels I failed to lock: ${map.failed}\n`;
    if (map.alreadyLocked) content += `└ Channels that were already locked: ${map.alreadyLocked}\n`;

    await interaction
      .followUp({
        content,
        ephemeral
      })
      .catch(() => {
        interaction.channel?.send({ content }).catch(() => {});
      });

    return null;
  }

  public static async endLockdown(data: {
    interaction: ChatInputCommandInteraction<'cached'>;
    ephemeral: boolean;
    config: GuildConfig;
    reason: string;
    notifyChannels: boolean;
  }): Promise<InteractionReplyData | null> {
    const { interaction, ephemeral, config, reason, notifyChannels } = data;
    const { lockdown_channels, lockdown_overrides, lockdown_display_executor } = config;

    if (!lockdown_channels.length) {
      return {
        error:
          'No channels have been set up for lockdown thus none can be unlocked with this command. You can add them using the `/settings lockdown` command.',
        temporary: true
      };
    }

    let unknownChannels: string[] = [];
    let failedChannels: string[] = [];
    let unlockedChannels: string[] = [];
    let alreadyUnlockedChannels: string[] = [];

    await interaction.reply({ content: `Ending lockdown...`, ephemeral });

    for (const channelId of lockdown_channels) {
      const channel = interaction.guild.channels.cache.get(channelId) as
        | TextChannel
        | VoiceChannel
        | ForumChannel
        | undefined;

      if (!channel) {
        unknownChannels.push(channelId);
        continue;
      }

      if (!interaction.appPermissions.has(PermissionFlagsBits.Administrator)) {
        if (!channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageChannels)) {
          failedChannels.push(channelId);
          continue;
        }

        if (
          !channel.permissionOverwrites.cache.some(override => {
            if (override.id === interaction.guildId) return false;
            return override.allow.has(lockdown_overrides);
          })
        ) {
          failedChannels.push(channelId);
          continue;
        }
      }

      const lockAllowOverrides =
        (
          await prisma.channelLock.findUnique({
            where: { id: channel.id, guild_id: interaction.guildId }
          })
        )?.overwrites ?? 0n;

      const everyoneOverride = channel.permissionOverwrites.cache.get(interaction.guildId);
      const everyoneOverrideDeny = everyoneOverride?.deny.bitfield ?? 0n;
      const everyoneOverrideAllow = everyoneOverride?.allow.bitfield ?? 0n;

      const updatedDenyOverride = everyoneOverrideDeny - (everyoneOverrideDeny & lockdown_overrides);
      const newAllowOverride =
        everyoneOverrideAllow + (lockAllowOverrides - (everyoneOverrideAllow & lockAllowOverrides));

      if (lockAllowOverrides !== 0n) {
        await prisma.channelLock.delete({ where: { id: channel.id, guild_id: interaction.guildId } });
      }

      if (updatedDenyOverride === everyoneOverrideDeny) {
        alreadyUnlockedChannels.push(channelId);
        continue;
      }

      await channel.permissionOverwrites.set(
        [
          ...channel.permissionOverwrites.cache.values(),
          {
            id: interaction.guildId,
            deny: updatedDenyOverride,
            allow: newAllowOverride
          }
        ],
        elipsify(`Unlocked by @${interaction.user.username} (${interaction.user.id}) - ${reason}`, 128)
      );

      if (channel.id !== interaction.channelId && channel.isTextBased() && notifyChannels) {
        await channel
          .send({ content: `This channel has been unlocked due to the server wide lockdown ending.` })
          .catch(() => {});
      }

      unlockedChannels.push(channelId);

      // Pause for a second to prevent rate limiting
      await sleep(1000);
    }

    if (!unlockedChannels.length) {
      await interaction.followUp({
        content: `I could not find any channels to unlock.`,
        ephemeral
      });

      return null;
    }

    const map = Lockdown._parseChannelMap({
      unknownChannels,
      failedChannels,
      alreadyLockedChannels: alreadyUnlockedChannels
    });

    const embed = new EmbedBuilder()
      .setColor(INFRACTION_COLORS.Unmute)
      .setAuthor({ name: client.user!.username, iconURL: client.user!.displayAvatarURL() })
      .setTitle('Server Unlocked')
      .setDescription(
        `This server has been taken out of lockdown${lockdown_display_executor ? ` by ${interaction.user}` : ''}.`
      )
      .setFields([{ name: 'Reason', value: reason }])
      .setTimestamp();

    await interaction.channel?.send({ embeds: [embed] }).catch(() => {});

    let content = `Successfully unlocked \`${unlockedChannels.length}\` out of \`${
      lockdown_channels.length
    }\` ${pluralize(lockdown_channels.length, 'channel')}.\n`;

    if (map.unknown) content += `└ Channels I failed to fetch: ${map.unknown}\n`;
    if (map.failed) content += `└ Channels I failed to unlock: ${map.failed}\n`;
    if (map.alreadyLocked) content += `└ Channels that were already unlocked: ${map.alreadyLocked}\n`;

    await interaction
      .followUp({
        content,
        ephemeral
      })
      .catch(() => {
        interaction.channel?.send({ content }).catch(() => {});
      });

    return null;
  }

  private static _parseChannelMap(data: {
    unknownChannels: string[];
    failedChannels: string[];
    alreadyLockedChannels: string[];
  }): Record<keyof typeof channelTypes, string | number> {
    const channelTypes = {
      unknown: data.unknownChannels,
      failed: data.failedChannels,
      alreadyLocked: data.alreadyLockedChannels
    } as const;

    return Object.entries(channelTypes).reduce(
      (acc, [key, channels]) => ({
        ...acc,
        [key]: channels.length ? channels.map(channelMention).join(', ') : null
      }),
      {} as Record<keyof typeof channelTypes, string | number>
    );
  }
}

enum LockdownSubcommand {
  Start = 'start',
  End = 'end'
}
