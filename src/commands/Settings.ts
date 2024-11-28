import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  ForumChannel,
  GuildTextBasedChannel,
  PermissionFlagsBits,
  TextChannel,
  VoiceChannel
} from 'discord.js';
import { PermissionEnum } from '@prisma/client';

import ms from 'ms';

import { prisma } from '..';
import { isCategory } from './Config';
import { CHANNEL_PERMISSION_OVERRIDES } from '@utils/Constants';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { parseDuration, pluralize, uploadData } from '@utils/index';

import Command, { CommandCategory } from '@managers/commands/Command';
import CommandManager from '@managers/commands/CommandManager';

export default class Settings extends Command {
  constructor() {
    super({
      category: CommandCategory.Management,
      data: {
        name: 'settings',
        description: 'View or change the server settings.',
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        options: [
          {
            name: SettingsSubcommandGroup.Permissions,
            description: 'Permission settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: SettingsSubcommand.CreateNode,
                description: 'Create a new permission node.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'name',
                    description: 'The name of the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    max_length: 50
                  },
                  {
                    name: 'role',
                    description: 'The first role to add to the permission node.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'permission',
                    description: 'The first permission to add to the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Search Infractions', value: PermissionEnum.SearchInfractions },
                      { name: 'Manage User Reports', value: PermissionEnum.ManageUserReports },
                      { name: 'Manage Message Reports', value: PermissionEnum.ManageMessageReports },
                      { name: 'Manage Mute Requests', value: PermissionEnum.ManageMuteRequests },
                      { name: 'Manage Ban Requests', value: PermissionEnum.ManageBanRequests },
                      { name: 'Delete Infractions', value: PermissionEnum.DeleteInfractions },
                      { name: 'Update Infractions', value: PermissionEnum.UpdateInfractions },
                      { name: 'Lock Channels', value: PermissionEnum.LockChannels },
                      { name: 'Unlock Channels', value: PermissionEnum.UnlockChannels },
                      { name: 'Start Lockdown', value: PermissionEnum.StartLockdown },
                      { name: 'End Lockdown', value: PermissionEnum.EndLockdown },
                      { name: 'Override Lockdown Notifications', value: PermissionEnum.OverrideLockdownNotificatons }
                    ]
                  }
                ]
              },
              {
                name: SettingsSubcommand.DeleteNode,
                description: 'Delete a permission node.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'permission-node',
                    description: 'The name of the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.AddRoleToNode,
                description: 'Add a role to a permission node.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'permission-node',
                    description: 'The name of the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'role',
                    description: 'The role.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.RemoveRoleFromNode,
                description: 'Remove a role from a permission node.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'permission-node',
                    description: 'The name of the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'role',
                    description: 'The role.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.GrantPermission,
                description: 'Grant a permission to a permission node.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'permission-node',
                    description: 'The name of the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'permission',
                    description: 'The permission.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Search Infractions', value: PermissionEnum.SearchInfractions },
                      { name: 'Manage User Reports', value: PermissionEnum.ManageUserReports },
                      { name: 'Manage Message Reports', value: PermissionEnum.ManageMessageReports },
                      { name: 'Manage Mute Requests', value: PermissionEnum.ManageMuteRequests },
                      { name: 'Manage Ban Requests', value: PermissionEnum.ManageBanRequests },
                      { name: 'Delete Infractions', value: PermissionEnum.DeleteInfractions },
                      { name: 'Update Infractions', value: PermissionEnum.UpdateInfractions },
                      { name: 'Lock Channels', value: PermissionEnum.LockChannels },
                      { name: 'Unlock Channels', value: PermissionEnum.UnlockChannels },
                      { name: 'Start Lockdown', value: PermissionEnum.StartLockdown },
                      { name: 'End Lockdown', value: PermissionEnum.EndLockdown },
                      { name: 'Override Lockdown Notifications', value: PermissionEnum.OverrideLockdownNotificatons }
                    ]
                  }
                ]
              },
              {
                name: SettingsSubcommand.RevokePermission,
                description: 'Revoke a permission from a permission node.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'permission-node',
                    description: 'The name of the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'permission',
                    description: 'The permission to revoke.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Search Infractions', value: PermissionEnum.SearchInfractions },
                      { name: 'Manage User Reports', value: PermissionEnum.ManageUserReports },
                      { name: 'Manage Message Reports', value: PermissionEnum.ManageMessageReports },
                      { name: 'Manage Mute Requests', value: PermissionEnum.ManageMuteRequests },
                      { name: 'Manage Ban Requests', value: PermissionEnum.ManageBanRequests },
                      { name: 'Delete Infractions', value: PermissionEnum.DeleteInfractions },
                      { name: 'Update Infractions', value: PermissionEnum.UpdateInfractions },
                      { name: 'Lock Channels', value: PermissionEnum.LockChannels },
                      { name: 'Unlock Channels', value: PermissionEnum.UnlockChannels },
                      { name: 'Start Lockdown', value: PermissionEnum.StartLockdown },
                      { name: 'End Lockdown', value: PermissionEnum.EndLockdown },
                      { name: `Override Lockdown Notifications`, value: PermissionEnum.OverrideLockdownNotificatons }
                    ]
                  }
                ]
              },
              {
                name: SettingsSubcommand.ListNodes,
                description: 'List all the permission nodes.',
                type: ApplicationCommandOptionType.Subcommand
              }
            ]
          },
          {
            name: SettingsSubcommandGroup.Commands,
            description: 'Command settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: SettingsSubcommand.Toggle,
                description: 'Enable or disable a command.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'command',
                    description: 'The name of the command.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.ToggleDefaultEphemeralReply,
                description: 'Toggle default ephemeral replies.',
                type: ApplicationCommandOptionType.Subcommand
              },
              {
                name: SettingsSubcommand.TimeToLive,
                description: 'Set the time-to-live for interaction replies.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The interaction type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Command Error', value: 'commandErrorTTL' },
                      { name: 'Command Temporary Response', value: 'commandTemporaryReplyTTL' },
                      { name: 'Component Error', value: 'componentErrorTTL' },
                      { name: 'Component Temporary Response', value: 'componentTemporaryReplyTTL' }
                    ]
                  },
                  {
                    name: 'duration',
                    description: 'The duration.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.CreateEphemeralScope,
                description: 'Create a new ephemeral scope.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'command',
                    description: 'The name of the command this scope will apply for.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'include-channel',
                    description: 'The channel or category this scope will include.',
                    type: ApplicationCommandOptionType.Channel,
                    required: false,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildCategory]
                  },
                  {
                    name: 'exclude-channel',
                    description: 'The channel or category this scope will exclude.',
                    type: ApplicationCommandOptionType.Channel,
                    required: false,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildCategory]
                  }
                ]
              },
              {
                name: SettingsSubcommand.DeleteEphemeralScope,
                description: 'Delete an ephemeral scope.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'scope',
                    description: 'The name of the scope.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.AddIncludedChannel,
                description: 'Add a channel or category to an ephemeral scope.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'scope',
                    description: 'The name of the scope.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'channel',
                    description: 'The channel or category.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildCategory]
                  }
                ]
              },
              {
                name: SettingsSubcommand.RemoveIncludedChannel,
                description: 'Remove a channel or category from an ephemeral scope.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'scope',
                    description: 'The name of the scope.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'channel',
                    description: 'The channel or category.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildCategory]
                  }
                ]
              },
              {
                name: SettingsSubcommand.AddExcludedChannel,
                description: 'Add a channel or category to exclude from an ephemeral scope.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'scope',
                    description: 'The name of the scope.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'channel',
                    description: 'The channel or category.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildCategory]
                  }
                ]
              },
              {
                name: SettingsSubcommand.RemoveExcludedChannel,
                description: 'Remove a channel or category from an ephemeral scope.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'scope',
                    description: 'The name of the scope.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'channel',
                    description: 'The channel or category.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildCategory]
                  }
                ]
              },
              {
                name: SettingsSubcommand.ListEphemeralScopes,
                description: 'List all the ephemeral scopes.',
                type: ApplicationCommandOptionType.Subcommand
              }
            ]
          },
          {
            name: SettingsSubcommandGroup.Infractions,
            description: 'Infraction settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: SettingsSubcommand.RequireReason,
                description: 'Require a reason for issuing an infraction.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The infraction type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Warn', value: 'requireWarnReason' },
                      { name: 'Mute', value: 'requireMuteReason' },
                      { name: 'Kick', value: 'requireKickReason' },
                      { name: 'Ban', value: 'requireBanReason' },
                      { name: 'Unmute', value: 'requireUnmuteReason' },
                      { name: 'Unban', value: 'requireUnbanReason' }
                    ]
                  }
                ]
              },
              {
                name: SettingsSubcommand.SetDefaultDuration,
                description: 'Set the default duration for an infraction type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The infraction type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Warn', value: 'defaultWarnDuration' },
                      { name: 'Mute', value: 'defaultMuteDuration' },
                      { name: 'Ban', value: 'defaultBanDuration' }
                    ]
                  },
                  {
                    name: 'duration',
                    description: 'The duration.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.ToggleNotifications,
                description: 'Toggle notification DMs when a user is punished.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The infraction type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Warn', value: 'notifyWarnAction' },
                      { name: 'Mute', value: 'notifyMuteAction' },
                      { name: 'Kick', value: 'notifyKickAction' },
                      { name: 'Ban', value: 'notifyBanAction' },
                      { name: 'Unmute', value: 'notifyUnmuteAction' }
                    ]
                  }
                ]
              },
              {
                name: SettingsSubcommand.ToggleNativeIntegration,
                description: 'Toggle tracking of infractions from native moderation.',
                type: ApplicationCommandOptionType.Subcommand
              }
            ]
          },
          {
            name: SettingsSubcommandGroup.Lockdown,
            description: 'Lockdown settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: SettingsSubcommand.AddChannel,
                description: 'Add a channel to the lockdown list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum]
                  }
                ]
              },
              {
                name: SettingsSubcommand.RemoveChannel,
                description: 'Remove a channel from the lockdown list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum]
                  }
                ]
              },
              {
                name: SettingsSubcommand.ListChannels,
                description: 'List all the channels in the lockdown list.',
                type: ApplicationCommandOptionType.Subcommand
              },
              {
                name: SettingsSubcommand.AddOverride,
                description: 'Add an override to deny when locking channels.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'override',
                    description: 'The override.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.RemoveOverride,
                description: 'Remove an override from the deny list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'override',
                    description: 'The override.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.ListOverrides,
                description: 'List all the overrides in the deny list.',
                type: ApplicationCommandOptionType.Subcommand
              },
              {
                name: SettingsSubcommand.ToggleNotifications,
                description: `Toggle notifying all channels when a lock/unlock occurs.`,
                type: ApplicationCommandOptionType.Subcommand
              },
              {
                name: SettingsSubcommand.DisplayExecutor,
                description: 'Toggle displaying the executor when a lock/unlock completes.',
                type: ApplicationCommandOptionType.Subcommand
              },
              {
                name: SettingsSubcommand.RequireReason,
                description: 'Require a reason for initiating locks/unlocks.',
                type: ApplicationCommandOptionType.Subcommand
              }
            ]
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
    const group = interaction.options.getSubcommandGroup() as SettingsSubcommandGroup;
    const subcommand = interaction.options.getSubcommand() as SettingsSubcommand;

    await interaction.deferReply({ ephemeral });

    switch (group) {
      case SettingsSubcommandGroup.Permissions:
        {
          switch (subcommand) {
            case SettingsSubcommand.CreateNode:
              return Settings.Permissions.createNode(interaction, config);
            case SettingsSubcommand.DeleteNode:
              return Settings.Permissions.deleteNode(interaction, config);
            case SettingsSubcommand.AddRoleToNode:
              return Settings.Permissions.addRoleToNode(interaction, config);
            case SettingsSubcommand.RemoveRoleFromNode:
              return Settings.Permissions.removeRoleFromNode(interaction, config);
            case SettingsSubcommand.GrantPermission:
              return Settings.Permissions.addPermission(interaction, config);
            case SettingsSubcommand.RevokePermission:
              return Settings.Permissions.removePermission(interaction, config);
            case SettingsSubcommand.ListNodes:
              return Settings.Permissions.listNodes(interaction, config);
          }
        }

        break;

      case SettingsSubcommandGroup.Commands:
        {
          switch (subcommand) {
            case SettingsSubcommand.Toggle:
              return Settings.Commands.toggleCommand(interaction, config);
            case SettingsSubcommand.ToggleDefaultEphemeralReply:
              return Settings.Commands.toggleDefaultEphemeralReply(config);
            case SettingsSubcommand.TimeToLive:
              return Settings.Commands.setTimeToLive(interaction, config);
            case SettingsSubcommand.CreateEphemeralScope:
              return Settings.Commands.createScope(interaction, config);
            case SettingsSubcommand.DeleteEphemeralScope:
              return Settings.Commands.deleteScope(interaction, config);
            case SettingsSubcommand.AddIncludedChannel:
              return Settings.Commands.addIncludedChannel(interaction, config);
            case SettingsSubcommand.RemoveIncludedChannel:
              return Settings.Commands.removeIncludedChannel(interaction, config);
            case SettingsSubcommand.AddExcludedChannel:
              return Settings.Commands.addExcludedChannel(interaction, config);
            case SettingsSubcommand.RemoveExcludedChannel:
              return Settings.Commands.removeExcludedChannel(interaction, config);
            case SettingsSubcommand.ListEphemeralScopes:
              return Settings.Commands.listEphemeralScopes(interaction, config);
          }
        }

        break;

      case SettingsSubcommandGroup.Infractions:
        {
          switch (subcommand) {
            case SettingsSubcommand.RequireReason:
              return Settings.Infractions.requireReason(interaction, config);
            case SettingsSubcommand.SetDefaultDuration:
              return Settings.Infractions.setDefaultDuration(interaction, config);
            case SettingsSubcommand.ToggleNotifications:
              return Settings.Infractions.toggleNotifications(interaction, config);
            case SettingsSubcommand.ToggleNativeIntegration:
              return Settings.Infractions.toggleNativeIntegration(interaction, config);
          }
        }

        break;

      case SettingsSubcommandGroup.Lockdown: {
        switch (subcommand) {
          case SettingsSubcommand.AddChannel:
            return Settings.Lockdown.addChannel(interaction, config);
          case SettingsSubcommand.RemoveChannel:
            return Settings.Lockdown.removeChannel(interaction, config);
          case SettingsSubcommand.ListChannels:
            return Settings.Lockdown.listChannels(interaction, config);
          case SettingsSubcommand.AddOverride:
            return Settings.Lockdown.addOverride(interaction, config);
          case SettingsSubcommand.RemoveOverride:
            return Settings.Lockdown.removeOverride(interaction, config);
          case SettingsSubcommand.ListOverrides:
            return Settings.Lockdown.listOverrides(interaction, config);
          case SettingsSubcommand.ToggleNotifications:
            return Settings.Lockdown.toggleNotifications(config);
          case SettingsSubcommand.DisplayExecutor:
            return Settings.Lockdown.showExecutor(config);
          case SettingsSubcommand.RequireReason:
            return Settings.Lockdown.requireReason(config);
        }
      }
    }

    return {
      error: 'An unknown error occurred.',
      temporary: true
    };
  }

  /**
   * Collection of subcommands for the Permissions subcommand group.
   */

  public static Permissions = {
    async createNode(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('name', true);
      const role = interaction.options.getRole('role', true);
      const permission = interaction.options.getString('permission', true) as PermissionEnum;

      if (config.permissions.find(permission => permission.name === name)) {
        return {
          error: `A permission node with that name already exists.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permissions: { push: { name, roles: [role.id], allow: [permission] } }
        }
      });

      return {
        content: `Successfully created the permission node \`${name}\`.`
      };
    },

    async deleteNode(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('permission-node', true);
      const permission = config.permissions.find(permission => permission.name === name);

      if (!permission) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permissions: {
            set: config.permissions.filter(permissions => permissions !== permission)
          }
        }
      });

      return {
        content: `Successfully deleted the permission node \`${name}\`.`
      };
    },

    async addRoleToNode(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('permission-node', true);
      const role = interaction.options.getRole('role', true);

      const permission = config.permissions.find(permission => permission.name === name);

      if (!permission) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (permission.roles.includes(role.id)) {
        return {
          error: `The role ${role} is already in the permission node.`,
          temporary: true
        };
      }

      permission.roles.push(role.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permissions: {
            set: config.permissions.map(p => (p.name === permission.name ? permission : p))
          }
        }
      });

      return {
        content: `Successfully added the role ${role} to the permission node.`
      };
    },

    async removeRoleFromNode(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('permission-node', true);
      const role = interaction.options.getRole('role', true);

      const permission = config.permissions.find(permission => permission.name === name);

      if (!permission) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (!permission.roles.includes(role.id)) {
        return {
          error: `The role ${role} is not in the permission node.`,
          temporary: true
        };
      }

      permission.roles = permission.roles.filter(r => r !== role.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permissions: {
            set: config.permissions.map(p => (p.name === permission.name ? permission : p))
          }
        }
      });

      return {
        content: `Successfully removed the role ${role} from the permission node.`
      };
    },

    async addPermission(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('permission-node', true);
      const permission = interaction.options.getString('permission', true) as PermissionEnum;

      const permissionNode = config.permissions.find(permission => permission.name === name);

      if (!permissionNode) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (permissionNode.allow.includes(permission)) {
        return {
          error: `The permission \`${permission.replaceAll(
            /([a-z])([A-Z])/g,
            '$1 $2'
          )}\` is already in the permission node.`,
          temporary: true
        };
      }

      permissionNode.allow.push(permission);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permissions: {
            set: config.permissions.map(p => (p.name === permissionNode.name ? permissionNode : p))
          }
        }
      });

      return {
        content: `Successfully added the permission \`${permission.replaceAll(
          /([a-z])([A-Z])/g,
          '$1 $2'
        )}\` to the permission node.`
      };
    },

    async removePermission(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('permission-node', true);
      const permission = interaction.options.getString('permission', true) as PermissionEnum;

      const permissionNode = config.permissions.find(permission => permission.name === name);

      if (!permissionNode) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (!permissionNode.allow.includes(permission)) {
        return {
          error: `The permission \`${permission.replaceAll(
            /([a-z])([A-Z])/g,
            '$1 $2'
          )}\` is not in the permission node.`,
          temporary: true
        };
      }

      permissionNode.allow = permissionNode.allow.filter(p => p !== permission);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permissions: {
            set: config.permissions.map(p => (p.name === permissionNode.name ? permissionNode : p))
          }
        }
      });

      return {
        content: `Successfully removed the permission \`${permission.replaceAll(
          /([a-z])([A-Z])/g,
          '$1 $2'
        )}\` from the permission node.`
      };
    },

    async listNodes(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      if (!config.permissions.length) {
        return {
          content: 'There are no permission nodes for this server.',
          temporary: true
        };
      }

      const map = (
        await Promise.all(
          config.permissions.map(async permission => {
            const roles = await Promise.all(
              permission.roles.map(async id => {
                const role = await interaction.guild.roles.fetch(id).catch(() => null);
                return role ? role : { id: id, name: 'Unknown Role' };
              })
            );

            return `Name: ${permission.name}\n└── Included Roles: ${
              roles.length ? roles.map(r => `@${r.name} (${r.id})`).join(', ') : 'None'
            }\n└── Allowed Permissions: ${permission.allow.join(', ').replaceAll(/([a-z])([A-Z])/g, '$1 $2')}`;
          })
        )
      ).join('\n\n');

      const dataUrl = await uploadData(map, 'txt');
      const buffer = Buffer.from(map, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'permission-nodes.txt' });

      const urlButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open in Browser').setURL(dataUrl);
      const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton);

      return {
        content: `There ${config.permissions.length > 1 ? 'are' : 'is'} **${config.permissions.length}** ${pluralize(
          config.permissions.length,
          'permission node'
        )} for this server.`,
        files: [attachment],
        components: [actionRow]
      };
    }
  };

  /**
   * Collection of subcommands for the Commands subcommand group.
   */

  public static Commands = {
    async toggleCommand(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const commandName = interaction.options.getString('command', true);

      const command = CommandManager.commands.get(commandName);

      if (!command || command.category === CommandCategory.Developer) {
        return {
          error: `The command \`${commandName}\` does not exist.`,
          temporary: true
        };
      }

      let { commandDisabledList } = config;

      let toggle = false;

      if (commandDisabledList.includes(command.data.name)) {
        commandDisabledList = commandDisabledList.filter(c => c !== command.data.name);
        toggle = true;
      } else {
        commandDisabledList.push(command.data.name);
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { commandDisabledList }
      });

      return {
        content: `Successfully ${toggle ? 're-enabled' : 'disabled'} command \`${command.data.name}\`.`
      };
    },
    async setTimeToLive(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('type', true) as keyof typeof config;
      const rawDuration = interaction.options.getString('duration', true);

      const duration = parseDuration(rawDuration);

      if (!duration || isNaN(duration)) {
        return {
          error: 'Invalid duration. The valid format is `<number>[s/m]` (`<number> [second/minute]`).',
          temporary: true
        };
      }

      if (duration < 1000) {
        return {
          error: 'The duration must be at least 1 second.',
          temporary: true
        };
      }

      if (duration > 60000) {
        return {
          error: 'The duration must not exceed 1 minute.',
          temporary: true
        };
      }

      if (config[type] === duration) {
        return {
          error: `The time-to-live for this interaction type is already set to **${ms(Math.floor(duration), {
            long: true
          })}**.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: duration }
      });

      return {
        content: `The time-to-live for the specified interaction type has been set to **${ms(Math.floor(duration), {
          long: true
        })}**.`
      };
    },

    async createScope(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      let commandName = interaction.options.getString('command', true);
      const includeChannel = interaction.options.getChannel('include-channel', false) as
        | GuildTextBasedChannel
        | CategoryChannel
        | null;

      const excludeChannel = interaction.options.getChannel('exclude-channel') as
        | GuildTextBasedChannel
        | CategoryChannel
        | null;

      const command =
        CommandManager.commands.get(commandName) ?? CommandManager.commands.get(commandName.toLowerCase());

      if (!command || command.category === CommandCategory.Developer) {
        return {
          error: `The command \`${commandName}\` does not exist.`,
          temporary: true
        };
      }

      if (config.ephemeralScopes.find(scope => scope.commandName === command.data.name)) {
        return {
          error: `An ephemeral scope for the command \`${command.data.name}\` already exists.`,
          temporary: true
        };
      }

      if (excludeChannel && includeChannel && excludeChannel.id === includeChannel.id) {
        return {
          error: 'The channel to exclude must be different from the channel to include.',
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: {
            push: {
              commandName: command.data.name,
              includedChannels: includeChannel ? [includeChannel.id] : [],
              excludedChannels: excludeChannel ? [excludeChannel.id] : []
            }
          }
        }
      });

      return {
        content: `Successfully created the ephemeral scope for the command \`${command.data.name}\`.`
      };
    },

    async deleteScope(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const scopeName = interaction.options.getString('scope', true);

      const scope = config.ephemeralScopes.find(scope => scope.commandName === scopeName);

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: {
            set: config.ephemeralScopes.filter(s => s !== scope)
          }
        }
      });

      return {
        content: `Successfully deleted the ephemeral scope for the command \`${scopeName}\`.`
      };
    },

    async addIncludedChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const scopeName = interaction.options.getString('scope', true);
      const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | CategoryChannel;

      const scope = config.ephemeralScopes.find(scope => scope.commandName === scopeName);

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      if (scope.includedChannels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel}  is already in the included channels list for the scope.`,
          temporary: true
        };
      }

      if (scope.excludedChannels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is in the excluded channels list for the scope. Remove it from the excluded channels list first.`,
          temporary: true
        };
      }

      if (channel instanceof TextChannel && channel.parentId) {
        if (scope.includedChannels.includes(channel.parentId)) {
          return {
            error: `You cannot add this channel to the scope because the parent category of the channel is already included.`,
            temporary: true
          };
        }
      }

      scope.includedChannels.push(channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: {
            set: config.ephemeralScopes.map(s => (s.commandName === scope.commandName ? scope : s))
          }
        }
      });

      return {
        content: `Successfully added the ${
          isCategory(channel) ? 'channel' : 'category'
        } ${channel} to the included channels list for the scope.`
      };
    },

    async removeIncludedChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const scopeName = interaction.options.getString('scope', true);
      const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | CategoryChannel;

      const scope = config.ephemeralScopes.find(scope => scope.commandName === scopeName);

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      if (!scope.includedChannels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is not in the included channels list for the scope.`,
          temporary: true
        };
      }

      scope.includedChannels = scope.includedChannels.filter(c => c !== channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: {
            set: config.ephemeralScopes.map(s => (s.commandName === scope.commandName ? scope : s))
          }
        }
      });

      return {
        content: `Successfully removed the ${
          isCategory(channel) ? 'category' : 'channel'
        } ${channel} from the included channels list for the scope.`
      };
    },

    async addExcludedChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const scopeName = interaction.options.getString('scope', true);
      const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | CategoryChannel;

      const scope = config.ephemeralScopes.find(scope => scope.commandName === scopeName);

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      if (scope.excludedChannels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is already in the excluded channels list for the scope.`,
          temporary: true
        };
      }

      if (scope.includedChannels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is in the included channels list for the scope. Remove it from the included channels list first.`,
          temporary: true
        };
      }

      if (channel instanceof TextChannel && channel.parentId) {
        if (scope.includedChannels.includes(channel.parentId)) {
          return {
            error: `You cannot add this channel to the scope because the parent category of the channel is already excluded.`,
            temporary: true
          };
        }
      }

      scope.excludedChannels.push(channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: {
            set: config.ephemeralScopes.map(s => (s.commandName === scope.commandName ? scope : s))
          }
        }
      });

      return {
        content: `Successfully added the ${
          isCategory(channel) ? 'category' : 'channel'
        } ${channel} to the excluded channels list for the scope.`
      };
    },

    async removeExcludedChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const scopeName = interaction.options.getString('scope', true);
      const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | CategoryChannel;

      const scope = config.ephemeralScopes.find(scope => scope.commandName === scopeName);

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      if (!scope.excludedChannels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is not in the excluded channels list for the scope.`,
          temporary: true
        };
      }

      scope.excludedChannels = scope.excludedChannels.filter(c => c !== channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: {
            set: config.ephemeralScopes.map(s => (s.commandName === scope.commandName ? scope : s))
          }
        }
      });

      return {
        content: `Successfully removed the ${
          isCategory(channel) ? 'category' : 'channel'
        } ${channel} from the excluded channels list for the scope.`
      };
    },

    async listEphemeralScopes(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      if (config.ephemeralScopes.length < 1) {
        return {
          content: 'There are no ephemeral scopes set up in this server.'
        };
      }

      const map = await Promise.all(
        config.ephemeralScopes.map(async scope => {
          const includedChannels = await Promise.all(
            scope.includedChannels.map(id => {
              const channel = interaction.guild!.channels.cache.get(id);
              return channel ? `#${channel.name} (${id})` : `<#${id}>`;
            })
          );

          const excludedChannels = await Promise.all(
            scope.excludedChannels.map(id => {
              const channel = interaction.guild!.channels.cache.get(id);
              return channel ? `#${channel.name} (${id})` : `<#${id}>`;
            })
          );

          return `Command: ${scope.commandName}\n└── Included channels: ${includedChannels.join(
            ', '
          )}\n└── Excluded channels: ${excludedChannels.join(', ')}`;
        })
      );

      const dataUrl = await uploadData(map.join('\n\n'), 'txt');
      const urlButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open In Browser').setURL(dataUrl);
      const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton);

      const buffer = Buffer.from(map.join('\n\n'), 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'ephemeral-scopes.txt' });
      const length = config.ephemeralScopes.length;

      return {
        content: `There ${length > 1 ? 'are' : 'is'} currently **${config.ephemeralScopes.length}** ${pluralize(
          length,
          'ephemeral scope'
        )} configured in this server.`,
        files: [attachment],
        components: [actionRow]
      };
    },

    async toggleDefaultEphemeralReply(config: GuildConfig): Promise<InteractionReplyData> {
      let toggle = true;

      if (config.commandEphemeralReply) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: config.id },
        data: { commandEphemeralReply: toggle }
      });

      return {
        content: `Command replies are now ${toggle ? 'ephemeral' : 'non-ephemeral'} by default.`
      };
    }
  };

  /**
   * Collection of subcommands for the Infractions subcommand group.
   */

  public static Infractions = {
    async requireReason(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('type', true) as keyof typeof config;

      let toggle = true;

      if (config[type] === true) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `A reason is ${toggle ? 'now' : 'no longer'} required for issuing infractions of the specified type.`
      };
    },

    async setDefaultDuration(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('type', true) as keyof typeof config;
      const rawDuration = interaction.options.getString('duration', true);

      let duration = parseDuration(rawDuration);

      if (Number.isNaN(duration) && rawDuration.toLowerCase() !== 'none') {
        return {
          error: 'Invalid duration. The valid format is `<number>[s/m/h/d]` (`<number> [second/minute/hour/day]`).',
          temporary: true
        };
      }

      if (config[type] === duration) {
        return {
          error: `The default duration for this infraction type is already set to **${ms(Math.floor(duration), {
            long: true
          })}**.`,
          temporary: true
        };
      }

      if (duration < 1000 && rawDuration.toLowerCase() !== 'none') {
        return {
          error: 'The duration must be at least 1 second.',
          temporary: true
        };
      }

      if (type === 'defaultMuteDuration') {
        if (duration > ms('28d')) {
          return {
            error: 'The duration must not exceed 28 days for mute infractions.',
            temporary: true
          };
        }
      }

      if (duration > ms('365d')) {
        return {
          error: 'The duration must not exceed 1 year.',
          temporary: true
        };
      }

      if (rawDuration === 'none') duration = 0;

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: duration }
      });

      return {
        content: `The default duration for the specified infraction type has been ${
          rawDuration.toLowerCase() === 'none'
            ? 'reset'
            : `set to **${ms(Math.floor(duration), {
                long: true
              })}**`
        }.`
      };
    },

    async toggleNotifications(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
      const type = interaction.options.getString('type', true) as keyof typeof config;

      let toggle = true;

      if (config[type] === true) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `Users will ${
          toggle ? 'now' : 'no longer'
        } receive DM notifications for the specified infraction type.`
      };
    },

    async toggleNativeIntegration(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
      let toggle = true;

      if (config.nativeModerationIntegration) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { nativeModerationIntegration: toggle }
      });

      return {
        content: `Native moderation infractions will ${
          toggle ? 'now' : 'no longer'
        } be tracked by the infraction system.`
      };
    }
  };

  /**
   * Collection of subcommands for the Lockdown subcommand group.
   */

  public static Lockdown = {
    async addChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const channel = interaction.options.getChannel('channel', true) as
        | GuildTextBasedChannel
        | VoiceChannel
        | ForumChannel;

      if (config.lockdownChannels.includes(channel.id)) {
        return {
          error: `The channel ${channel} is already in the lockdown list.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { lockdownChannels: { push: channel.id } }
      });

      return {
        content: `Successfully added the channel ${channel} to the lockdown list.`
      };
    },

    async removeChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const channel = interaction.options.getChannel('channel', true) as
        | GuildTextBasedChannel
        | VoiceChannel
        | ForumChannel;

      if (!config.lockdownChannels.includes(channel.id)) {
        return {
          error: `The channel ${channel} is not in the lockdown list.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { lockdownChannels: { set: config.lockdownChannels.filter(c => c !== channel.id) } }
      });

      return {
        content: `Successfully removed the channel ${channel} from the lockdown list.`
      };
    },

    async listChannels(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      if (!config.lockdownChannels.length) {
        return {
          error: 'There are no channels in the lockdown list.',
          temporary: true
        };
      }

      const channels = await Promise.all(
        config.lockdownChannels.map(id => {
          const channel = interaction.guild.channels.cache.get(id);
          return channel ? `#${channel.name} (${id})` : `<#${id}>`;
        })
      );

      const dataUrl = await uploadData(channels.join('\n'), 'txt');
      const buffer = Buffer.from(channels.join('\n'), 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'lockdown-channels.txt' });

      const urlButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open In Browser').setURL(dataUrl);
      const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton);

      return {
        content: `There ${
          config.lockdownChannels.length > 1
            ? `are currently **${config.lockdownChannels.length}** channels`
            : `is currently **1** channel`
        } in the lockdown list.`,
        files: [attachment],
        components: [actionRow]
      };
    },

    async addOverride(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const override = interaction.options.getString('override', true);

      if (!PermissionFlagsBits.hasOwnProperty(override)) {
        return {
          error: 'Invalid override. Please select a valid permission override.',
          temporary: true
        };
      }

      const overrideBit = PermissionFlagsBits[override as keyof typeof PermissionFlagsBits];

      if (config.lockdownOverrides & overrideBit) {
        return {
          error: `This override is already in the deny list.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { lockdownOverrides: config.lockdownOverrides | overrideBit }
      });

      return {
        content: `The override \`${override.replaceAll(
          /[a-z][A-Z]/g,
          m => `${m[0]} ${m[1]}`
        )}\` will now be denied upon a channel lock.`
      };
    },

    async removeOverride(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const override = interaction.options.getString('override', true);

      if (!PermissionFlagsBits.hasOwnProperty(override)) {
        return {
          error: 'Invalid override. Please select a valid permission override.',
          temporary: true
        };
      }

      const overrideBit = PermissionFlagsBits[override as keyof typeof PermissionFlagsBits];

      if ((config.lockdownOverrides & overrideBit) === 0n) {
        return {
          error: `This override is not in the deny list.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { lockdownOverrides: config.lockdownOverrides ^ overrideBit }
      });

      return {
        content: `The override \`${override.replaceAll(
          /[a-z][A-Z]/g,
          m => `${m[0]} ${m[1]}`
        )}\` will no longer be denied upon a channel lock.`
      };
    },

    async listOverrides(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const overrides = Object.entries(PermissionFlagsBits)
        .filter(([_, bit]) => (config.lockdownOverrides & bit) === bit)
        .map(([name]) => name.replaceAll(/[a-z][A-Z]/g, m => `${m[0]} ${m[1]}`));

      if (!overrides.length) {
        return {
          error: 'There are no overrides in the deny list.',
          temporary: true
        };
      }

      const dataUrl = await uploadData(overrides.join('\n'), 'txt');
      const buffer = Buffer.from(overrides.join('\n'), 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'lockdown-overrides.txt' });

      const urlButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open In Browser').setURL(dataUrl);
      const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton);

      return {
        content: `There ${
          overrides.length > 1 ? `are currently **${overrides.length}** overrides` : `is currently **1** override`
        } in the deny list.`,
        files: [attachment],
        components: [actionRow]
      };
    },

    async showExecutor(config: GuildConfig): Promise<InteractionReplyData> {
      let toggle = true;

      if (config.lockdownDisplayExecutor) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: config.id },
        data: { lockdownDisplayExecutor: toggle }
      });

      return {
        content: `The executor responsible for locking channels will ${
          toggle ? 'now' : 'no longer'
        } be displayed in the information embed.`
      };
    },

    async toggleNotifications(config: GuildConfig): Promise<InteractionReplyData> {
      let toggle = true;

      if (config.lockdownNotify) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: config.id },
        data: { lockdownNotify: toggle }
      });

      return {
        content: `Channels in the lockdown list will ${
          toggle ? 'now' : 'no longer'
        } have a notification sent upon locking.`
      };
    },

    async requireReason(config: GuildConfig): Promise<InteractionReplyData> {
      let toggle = true;

      if (config.lockdownRequireReason) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: config.id },
        data: { lockdownRequireReason: toggle }
      });

      return {
        content: `A reason is ${toggle ? 'now' : 'no longer'} required for locking/unlocking channels.`
      };
    }
  };
}

enum SettingsSubcommandGroup {
  Infractions = 'infractions',
  Permissions = 'permissions',
  Commands = 'commands',
  Lockdown = 'lockdown'
}

enum SettingsSubcommand {
  Toggle = 'toggle',
  ToggleDefaultEphemeralReply = 'toggle-default-ephemeral-reply',
  RequireReason = 'require-reason',
  SetDefaultDuration = 'set-default-duration',
  ToggleNotifications = 'toggle-notifications',
  ToggleNativeIntegration = 'toggle-native-integration',
  TimeToLive = 'time-to-live',
  CreateEphemeralScope = 'create-ephemeral-scope',
  DeleteEphemeralScope = 'delete-ephemeral-scope',
  AddIncludedChannel = 'add-included-channel',
  RemoveIncludedChannel = 'remove-included-channel',
  AddExcludedChannel = 'add-excluded-channel',
  RemoveExcludedChannel = 'remove-excluded-channel',
  ListEphemeralScopes = 'list-ephemeral-scopes',
  CreateNode = 'create-node',
  DeleteNode = 'delete-node',
  AddRoleToNode = 'add-role-to-node',
  RemoveRoleFromNode = 'remove-role-from-node',
  GrantPermission = 'grant',
  RevokePermission = 'revoke',
  ListNodes = 'list-nodes',
  AddChannel = 'add-channel',
  RemoveChannel = 'remove-channel',
  ListChannels = 'list-channels',
  AddOverride = 'add-override',
  RemoveOverride = 'remove-override',
  ListOverrides = 'list-overrides',
  DisplayExecutor = 'display-executor'
}
