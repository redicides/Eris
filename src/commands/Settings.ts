import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
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

import ms from 'ms';

import { prisma } from '..';
import { isCategory } from './Config';
import { MaxDurationStr } from '@utils/Constants';
import { UserPermission } from '@utils/Enums';
import { EphemeralScope, GuildConfig, InteractionReplyData, PermissionNode } from '@utils/Types';
import { isEphemeralReply, parseDuration, pluralize, uploadData } from '@utils/index';

import Command, { CommandCategory } from '@eris/Command';
import CommandManager from '@managers/eris/CommandManager';

export default class Settings extends Command {
  constructor() {
    super({
      category: CommandCategory.Management,
      data: {
        name: 'settings',
        description: 'View or change the server settings.',
        // defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        type: ApplicationCommandType.ChatInput,
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
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.DeleteNode,
                description: 'Delete a permission node.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'node',
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
                    name: 'node',
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
                    name: 'node',
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
                    name: 'node',
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
                    autocomplete: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.RevokePermission,
                description: 'Revoke a permission from a permission node.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'node',
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
                    autocomplete: true
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
                name: SettingsSubcommand.SetDefaultReplyType,
                description: 'Set the default reply type for commands.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The default reply type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Ephemeral', value: 'ephemeral' },
                      { name: 'Non Ephemeral', value: 'non ephemeral' }
                    ]
                  }
                ]
              },
              {
                name: SettingsSubcommand.SetTimeToLive,
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
                name: SettingsSubcommand.ForceReason,
                description: 'Force a reason when issuing an infraction.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The infraction type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Warn', value: 'require_warn_reason' },
                      { name: 'Mute', value: 'require_mute_reason' },
                      { name: 'Kick', value: 'require_kick_reason' },
                      { name: 'Ban', value: 'require_ban_reason' },
                      { name: 'Unmute', value: 'require_unmute_reason' },
                      { name: 'Unban', value: 'require_unban_reason' }
                    ]
                  },
                  {
                    name: 'toggle',
                    description: 'Toggle for this setting.',
                    type: ApplicationCommandOptionType.Boolean,
                    required: true
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
                      { name: 'Warn', value: 'default_warn_duration' },
                      { name: 'Mute', value: 'default_mute_duration' },
                      { name: 'Ban', value: 'default_ban_duration' }
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
                name: SettingsSubcommand.SendNotificationDms,
                description: 'Notify users when they receive an infraction.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The infraction type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Warn', value: 'notify_warn_action' },
                      { name: 'Mute', value: 'notify_mute_action' },
                      { name: 'Kick', value: 'notify_kick_action' },
                      { name: 'Ban', value: 'notify_ban_action' },
                      { name: 'Unmute', value: 'notify_unmute_action' }
                    ]
                  },
                  {
                    name: 'toggle',
                    description: 'Toggle for this setting.',
                    type: ApplicationCommandOptionType.Boolean,
                    required: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.SetAdditionalInfo,
                description:
                  'Include additional details in the punishment DM sent to users when they receive an infraction.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The infraction type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Warn', value: 'default_additional_warn_info' },
                      { name: 'Mute', value: 'default_additional_mute_info' },
                      { name: 'Unmute', value: 'default_additional_unmute_info' },
                      { name: 'Kick', value: 'default_additional_kick_info' },
                      { name: 'Ban', value: 'default_additional_ban_info' }
                    ]
                  },
                  {
                    name: 'info',
                    description: 'The additional information. Use "none" to remove the current info.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    minLength: 1,
                    maxLength: 1024
                  }
                ]
              },
              {
                name: SettingsSubcommand.TrackNativeInfractions,
                description: 'Track natively issued infractions.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'toggle',
                    description: 'Toggle for this setting.',
                    type: ApplicationCommandOptionType.Boolean,
                    required: true
                  }
                ]
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
                name: SettingsSubcommand.SendChannelNotification,
                description: `Notify channels upon locking & unlocking.`,
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'toggle',
                    description: 'Toggle for this setting.',
                    type: ApplicationCommandOptionType.Boolean,
                    required: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.DisplayExecutor,
                description: 'Display the executor when locking & unlocking.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'toggle',
                    description: 'Toggle for this setting.',
                    type: ApplicationCommandOptionType.Boolean,
                    required: true
                  }
                ]
              },
              {
                name: SettingsSubcommand.ForceReason,
                description: 'Force a reason for locking & unlocking.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'toggle',
                    description: 'Toggle for this setting.',
                    type: ApplicationCommandOptionType.Boolean,
                    required: true
                  }
                ]
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
  ): Promise<InteractionReplyData> {
    const group = interaction.options.getSubcommandGroup() as SettingsSubcommandGroup;
    const subcommand = interaction.options.getSubcommand() as SettingsSubcommand;

    await interaction.deferReply({ ephemeral: isEphemeralReply(interaction, config) });

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
            case SettingsSubcommand.SetDefaultReplyType:
              return Settings.Commands.setDefaultReplyType(interaction, config);
            case SettingsSubcommand.SetTimeToLive:
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
            case SettingsSubcommand.ForceReason:
              return Settings.Infractions.forceReason(interaction, config);
            case SettingsSubcommand.SetDefaultDuration:
              return Settings.Infractions.setDefaultDuration(interaction, config);
            case SettingsSubcommand.SendNotificationDms:
              return Settings.Infractions.sendNotificationDms(interaction, config);
            case SettingsSubcommand.TrackNativeInfractions:
              return Settings.Infractions.trackNativeInfractions(interaction, config);
            case SettingsSubcommand.SetAdditionalInfo:
              return Settings.Infractions.setAdditionalInformation(interaction, config);
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
            return Settings.Lockdown.listOverrides(config);
          case SettingsSubcommand.SendChannelNotification:
            return Settings.Lockdown.toggleNotifications(interaction, config);
          case SettingsSubcommand.DisplayExecutor:
            return Settings.Lockdown.showExecutor(interaction, config);
          case SettingsSubcommand.ForceReason:
            return Settings.Lockdown.requireReason(interaction, config);
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
      const permission = interaction.options.getString('permission', true) as UserPermission;

      if (role.id === interaction.guildId) {
        return {
          error: 'You cannot create a permission node with the @everyone role.',
          temporary: true
        };
      }

      if ((config.permission_nodes as PermissionNode[]).find(permission => permission.name === name)) {
        return {
          error: `A permission node with that name already exists.`,
          temporary: true
        };
      }

      if (!UserPermission.hasOwnProperty(permission)) {
        return {
          error: `The provided permission (\`${permission.replaceAll('_', ' ')}\`) is invalid.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permission_nodes: { push: { name, roles: [role.id], allowed: [permission] } }
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
      const name = interaction.options.getString('node', true);
      const permission = (config.permission_nodes as PermissionNode[]).find(permission => permission.name === name);

      if (!permission) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permission_nodes: {
            set: (config.permission_nodes as PermissionNode[]).filter(permissions => permissions !== permission)
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
      const name = interaction.options.getString('node', true);
      const role = interaction.options.getRole('role', true);

      const permission = (config.permission_nodes as PermissionNode[]).find(permission => permission.name === name);

      if (!permission) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (role.id === interaction.guildId) {
        return {
          error: 'You cannot add the @everyone role to a permission node.',
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
          permission_nodes: {
            set: (config.permission_nodes as PermissionNode[]).map(p => (p.name === permission.name ? permission : p))
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
      const name = interaction.options.getString('node', true);
      const role = interaction.options.getRole('role', true);

      const permission = (config.permission_nodes as PermissionNode[]).find(permission => permission.name === name);

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
          permission_nodes: {
            set: (config.permission_nodes as PermissionNode[]).map(p => (p.name === permission.name ? permission : p))
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
      const name = interaction.options.getString('node', true);
      const permission = interaction.options.getString('permission', true) as UserPermission;

      const permissionNode = (config.permission_nodes as PermissionNode[]).find(permission => permission.name === name);

      if (!permissionNode) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (!UserPermission.hasOwnProperty(permission)) {
        return {
          error: `The provided permission (\`${permission.replaceAll('_', ' ')}\`) is invalid.`,
          temporary: true
        };
      }

      if (permissionNode.allowed.includes(permission)) {
        return {
          error: `The permission \`${permission.replaceAll('_', ' ')}\` is already allowed in the permission node.`,
          temporary: true
        };
      }

      permissionNode.allowed.push(permission);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permission_nodes: {
            set: (config.permission_nodes as PermissionNode[]).map(p =>
              p.name === permissionNode.name ? permissionNode : p
            )
          }
        }
      });

      return {
        content: `Successfully added the permission \`${permission.replaceAll('_', ' ')}\` to the permission node.`
      };
    },

    async removePermission(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('node', true);
      const permission = interaction.options.getString('permission', true) as UserPermission;

      const permissionNode = (config.permission_nodes as PermissionNode[]).find(permission => permission.name === name);

      if (!permissionNode) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (!UserPermission.hasOwnProperty(permission)) {
        return {
          error: `The provided permission (\`${permission.replaceAll('_', ' ')}\`) is invalid.`,
          temporary: true
        };
      }

      if (!permissionNode.allowed.includes(permission)) {
        return {
          error: `The permission \`${permission.replaceAll('_', ' ')}\` is not in the permission node.`,
          temporary: true
        };
      }

      permissionNode.allowed = permissionNode.allowed.filter(p => p !== permission);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          permission_nodes: {
            set: (config.permission_nodes as PermissionNode[]).map(p =>
              p.name === permissionNode.name ? permissionNode : p
            )
          }
        }
      });

      return {
        content: `Successfully removed the permission \`${permission.replaceAll('_', ' ')}\` from the permission node.`
      };
    },

    async listNodes(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      if (!config.permission_nodes.length) {
        return {
          content: 'There are no permission nodes for this server.',
          temporary: true
        };
      }

      const map = (
        await Promise.all(
          (config.permission_nodes as PermissionNode[]).map(async node => {
            const roles = await Promise.all(
              node.roles.map(async id => {
                const role = await interaction.guild.roles.fetch(id).catch(() => null);
                return role ? role : { id: id, name: 'Unknown Role' };
              })
            );

            return `Name: ${node.name}\n└ Included Roles: ${
              roles.length ? roles.map(r => `@${r.name} (${r.id})`).join(', ') : 'None'
            }\n└ Allowed Permissions: ${node.allowed.join(', ').replaceAll('_', ' ')}\n`;
          })
        )
      ).join('\n\n');

      const dataUrl = await uploadData(map, 'txt');
      const buffer = Buffer.from(map, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'permission-nodes.txt' });

      const urlButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open in Browser').setURL(dataUrl);
      const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton);

      return {
        content: `There ${config.permission_nodes.length > 1 ? 'are' : 'is'} **${
          config.permission_nodes.length
        }** ${pluralize(config.permission_nodes.length, 'permission node')} for this server.`,
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

      let toggle = false;

      const command = CommandManager.getCommand(commandName);
      const shortcut = await CommandManager.getShortcutByName(commandName, interaction.guildId);

      if (!command) {
        if (shortcut) {
          if (!shortcut.enabled) toggle = true;

          await prisma.shortcut.update({
            where: { name: shortcut.name, guild_id: interaction.guildId },
            data: { enabled: toggle }
          });

          return {
            content: `Successfully ${toggle ? 're-enabled' : 'disabled'} command \`${shortcut.name}\`.`
          };
        }

        return {
          error: `The command \`${commandName}\` does not exist.`,
          temporary: true
        };
      }

      if (command.category === CommandCategory.Developer) {
        return {
          error: `You cannot enable or disable a developer command.`,
          temporary: true
        };
      }

      let { command_disabled_list } = config;

      if (command_disabled_list.includes(command.data.name)) {
        command_disabled_list = command_disabled_list.filter(c => c !== command.data.name);
        toggle = true;
      } else {
        command_disabled_list.push(command.data.name);
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { command_disabled_list }
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
      const commandName = interaction.options.getString('command', true);
      const includeChannel = interaction.options.getChannel('include-channel', false) as
        | GuildTextBasedChannel
        | CategoryChannel
        | null;

      const excludeChannel = interaction.options.getChannel('exclude-channel') as
        | GuildTextBasedChannel
        | CategoryChannel
        | null;

      const command = CommandManager.getCommand(commandName);
      const shortcut = await CommandManager.getShortcutByName(commandName, interaction.guildId);

      if (!command && !shortcut) {
        return {
          error: `The command \`${commandName}\` does not exist.`,
          temporary: true
        };
      }

      if (command?.category === CommandCategory.Developer) {
        return {
          error: `You cannot create an ephemeral scope for a developer command.`,
          temporary: true
        };
      }

      const scopeName = shortcut ? shortcut.name : command ? command.data.name : null;

      if (!scopeName) {
        return {
          error: `The command \`${commandName}\` does not exist.`,
          temporary: true
        };
      }

      if (
        (config.ephemeral_scopes as EphemeralScope[] as EphemeralScope[]).find(
          scope => scope.command_name === scopeName
        )
      ) {
        return {
          error: `An ephemeral scope for the command \`${scopeName}\` already exists.`,
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
          ephemeral_scopes: {
            push: {
              commandName: scopeName,
              included_channels: includeChannel ? [includeChannel.id] : [],
              excluded_channels: excludeChannel ? [excludeChannel.id] : []
            }
          }
        }
      });

      return {
        content: `Successfully created the ephemeral scope for the command \`${scopeName}\`.`
      };
    },

    async deleteScope(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const scopeName = interaction.options.getString('scope', true);

      const scope = (config.ephemeral_scopes as EphemeralScope[] as EphemeralScope[]).find(
        scope => scope.command_name === scopeName
      );

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeral_scopes: {
            set: (config.ephemeral_scopes as EphemeralScope[] as EphemeralScope[]).filter(s => s !== scope)
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

      const scope = (config.ephemeral_scopes as EphemeralScope[] as EphemeralScope[]).find(
        scope => scope.command_name === scopeName
      );

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      if (scope.included_channels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel}  is already in the included channels list for the scope.`,
          temporary: true
        };
      }

      if (scope.excluded_channels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is in the excluded channels list for the scope. Remove it from the excluded channels list first.`,
          temporary: true
        };
      }

      if (channel instanceof TextChannel && channel.parentId) {
        if (scope.included_channels.includes(channel.parentId)) {
          return {
            error: `You cannot add this channel to the scope because the parent category of the channel is already included.`,
            temporary: true
          };
        }
      }

      scope.included_channels.push(channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeral_scopes: {
            set: (config.ephemeral_scopes as EphemeralScope[] as EphemeralScope[]).map(s =>
              s.command_name === scope.command_name ? scope : s
            )
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

      const scope = (config.ephemeral_scopes as EphemeralScope[] as EphemeralScope[]).find(
        scope => scope.command_name === scopeName
      );

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      if (!scope.included_channels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is not in the included channels list for the scope.`,
          temporary: true
        };
      }

      scope.included_channels = scope.included_channels.filter(c => c !== channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeral_scopes: {
            set: (config.ephemeral_scopes as EphemeralScope[] as EphemeralScope[]).map(s =>
              s.command_name === scope.command_name ? scope : s
            )
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

      const scope = (config.ephemeral_scopes as EphemeralScope[] as EphemeralScope[]).find(
        scope => scope.command_name === scopeName
      );

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      if (scope.excluded_channels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is already in the excluded channels list for the scope.`,
          temporary: true
        };
      }

      if (scope.included_channels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is in the included channels list for the scope. Remove it from the included channels list first.`,
          temporary: true
        };
      }

      if (channel instanceof TextChannel && channel.parentId) {
        if (scope.included_channels.includes(channel.parentId)) {
          return {
            error: `You cannot add this channel to the scope because the parent category of the channel is already excluded.`,
            temporary: true
          };
        }
      }

      scope.excluded_channels.push(channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeral_scopes: {
            set: (config.ephemeral_scopes as EphemeralScope[]).map(s =>
              s.command_name === scope.command_name ? scope : s
            )
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

      const scope = (config.ephemeral_scopes as EphemeralScope[]).find(scope => scope.command_name === scopeName);

      if (!scope) {
        return {
          error: `An ephemeral scope with the name \`${scopeName}\` does not exist.`,
          temporary: true
        };
      }

      if (!scope.excluded_channels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is not in the excluded channels list for the scope.`,
          temporary: true
        };
      }

      scope.excluded_channels = scope.excluded_channels.filter(c => c !== channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeral_scopes: {
            set: (config.ephemeral_scopes as EphemeralScope[]).map(s =>
              s.command_name === scope.command_name ? scope : s
            )
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
      if ((config.ephemeral_scopes as EphemeralScope[]).length < 1) {
        return {
          content: 'There are no ephemeral scopes set up in this server.'
        };
      }

      const map = await Promise.all(
        (config.ephemeral_scopes as EphemeralScope[]).map(async scope => {
          const includedChannels = await Promise.all(
            scope.included_channels.map(id => {
              const channel = interaction.guild.channels.cache.get(id);
              return channel ? `#${channel.name} (${id})` : `<#${id}>`;
            })
          );

          const excludedChannels = await Promise.all(
            scope.excluded_channels.map(id => {
              const channel = interaction.guild.channels.cache.get(id);
              return channel ? `#${channel.name} (${id})` : `<#${id}>`;
            })
          );

          return `Command: ${scope.command_name}\n└ Included channels: ${includedChannels.join(
            ', '
          )}\n└ Excluded channels: ${excludedChannels.join(', ')}`;
        })
      );

      const dataUrl = await uploadData(map.join('\n\n'), 'txt');
      const urlButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open In Browser').setURL(dataUrl);
      const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton);

      const buffer = Buffer.from(map.join('\n\n'), 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'ephemeral-scopes.txt' });
      const length = (config.ephemeral_scopes as EphemeralScope[]).length;

      return {
        content: `There ${length > 1 ? 'are' : 'is'} currently **${
          (config.ephemeral_scopes as EphemeralScope[]).length
        }** ${pluralize(length, 'ephemeral scope')} configured in this server.`,
        files: [attachment],
        components: [actionRow]
      };
    },

    async setDefaultReplyType(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('type', true) as 'ephemeral' | 'non ephemeral';

      if (
        (config.command_ephemeral_reply && type === 'ephemeral') ||
        (!config.command_ephemeral_reply && type === 'non ephemeral')
      ) {
        return {
          error: `The default reply type is already set to ${type}.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { command_ephemeral_reply: type === 'ephemeral' }
      });

      return {
        content: `The default reply type for commands has been set to ${type}.`
      };
    }
  };

  /**
   * Collection of subcommands for the Infractions subcommand group.
   */

  public static Infractions = {
    async setAdditionalInformation(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
      const type = interaction.options.getString('type', true) as keyof typeof config;
      let info: string | null = interaction.options.getString('info', true);

      if (info.toLowerCase() === 'none') info = null;

      if (config[type] === info) {
        return {
          error: `${
            info
              ? 'The new additional information cannot be the same as the current'
              : 'There is no additional information to reset.'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: info }
      });

      return {
        content: `Successfully ${info ? 'set' : 'reset'} the information for \`${Settings._parseInfractionKeys(
          type
        )}\` infractions.`
      };
    },

    async forceReason(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('type', true) as keyof typeof config;
      const toggle = interaction.options.getBoolean('toggle', true);

      if (config[type] === toggle) {
        return {
          error: `A reason is already ${
            toggle ? 'required' : 'not required'
          } for issuing \`${Settings._parseInfractionKeys(type)}\` infractions.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `A reason is ${toggle ? 'now' : 'no longer'} required for issuing \`${Settings._parseInfractionKeys(
          type
        )}\` infractions.`
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
          error: `The default duration for \`${Settings._parseInfractionKeys(
            type
          )}\` infractions is already set to **${ms(Math.floor(duration), {
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

      if (type === 'default_mute_duration') {
        if (duration > ms('28d')) {
          return {
            error: 'The duration must not exceed 28 days for mute infractions.',
            temporary: true
          };
        }
      }

      if (duration > ms(MaxDurationStr)) {
        return {
          error: 'The duration must not exceed 5 years.',
          temporary: true
        };
      }

      if (rawDuration === 'none') duration = 0;

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: duration }
      });

      return {
        content: `The default duration for the \`${Settings._parseInfractionKeys(type)}\` infraction type has been ${
          rawDuration.toLowerCase() === 'none'
            ? 'reset'
            : `set to **${ms(Math.floor(duration), {
                long: true
              })}**`
        }.`
      };
    },

    async sendNotificationDms(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
      const type = interaction.options.getString('type', true) as keyof typeof config;
      const toggle = interaction.options.getBoolean('toggle', true);

      if (config[type] === toggle) {
        return {
          error: `Users are already ${
            toggle ? 'receiving' : 'not receiving'
          } DM notifications for \`${Settings._parseInfractionKeys(type)}\` infractions.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `Users will ${
          toggle ? 'now' : 'no longer'
        } receive DM notifications for \`${Settings._parseInfractionKeys(type)}\` infractions.`
      };
    },

    async trackNativeInfractions(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const value = interaction.options.getBoolean('toggle', true);

      if (config.native_moderation_integration === value) {
        return {
          error: `Native infractions are already ${value ? 'being' : 'not being'} tracked.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { native_moderation_integration: value }
      });

      return {
        content: `Native infractions will now ${value ? 'be' : 'no longer be'} tracked.`
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

      if (config.lockdown_channels.includes(channel.id)) {
        return {
          error: `The channel ${channel} is already in the lockdown list.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { lockdown_channels: { push: channel.id } }
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

      if (!config.lockdown_channels.includes(channel.id)) {
        return {
          error: `The channel ${channel} is not in the lockdown list.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { lockdown_channels: { set: config.lockdown_channels.filter(c => c !== channel.id) } }
      });

      return {
        content: `Successfully removed the channel ${channel} from the lockdown list.`
      };
    },

    async listChannels(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      if (!config.lockdown_channels.length) {
        return {
          error: 'There are no channels in the lockdown list.',
          temporary: true
        };
      }

      const channels = await Promise.all(
        config.lockdown_channels.map(id => {
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
          config.lockdown_channels.length > 1
            ? `are currently **${config.lockdown_channels.length}** channels`
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

      if (config.lockdown_overrides & overrideBit) {
        return {
          error: `This override is already in the deny list.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { lockdown_overrides: config.lockdown_overrides | overrideBit }
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

      if ((config.lockdown_overrides & overrideBit) === 0n) {
        return {
          error: `This override is not in the deny list.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { lockdown_overrides: config.lockdown_overrides ^ overrideBit }
      });

      return {
        content: `The override \`${override.replaceAll(
          /[a-z][A-Z]/g,
          m => `${m[0]} ${m[1]}`
        )}\` will no longer be denied upon a channel lock.`
      };
    },

    async listOverrides(config: GuildConfig): Promise<InteractionReplyData> {
      const overrides = Object.entries(PermissionFlagsBits)
        .filter(([_, bit]) => (config.lockdown_overrides & bit) === bit)
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

    async showExecutor(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const toggle = interaction.options.getBoolean('toggle', true);

      if (config.lockdown_display_executor === toggle) {
        return {
          error: `The executor display setting is already ${toggle ? 'enabled' : 'disabled'}.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: config.id },
        data: { lockdown_display_executor: toggle }
      });

      return {
        content: `The executor responsible for locking or unlocking channels will ${
          toggle ? 'now' : 'no longer'
        } be displayed in the information embed.`
      };
    },

    async toggleNotifications(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const value = interaction.options.getBoolean('toggle', true);

      if (config.lockdown_notify === value) {
        return {
          error: `Channel notifications are already ${value ? 'enabled' : 'disabled'}.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: config.id },
        data: { lockdown_notify: value }
      });

      return {
        content: `Channels in the lockdown list will ${
          value ? 'now' : 'no longer'
        } have a notification sent upon locking.`
      };
    },

    async requireReason(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const toggle = interaction.options.getBoolean('toggle', true);

      if (config.lockdown_require_reason === toggle) {
        return {
          error: `A reason is already ${toggle ? 'required' : 'not required'} for locking/unlocking channels.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: config.id },
        data: { lockdown_require_reason: toggle }
      });

      return {
        content: `A reason is ${toggle ? 'now' : 'no longer'} required for locking/unlocking channels.`
      };
    }
  };

  public static _parseInfractionKeys(key: keyof GuildConfig) {
    switch (key) {
      case 'default_additional_ban_info':
      case 'require_ban_reason':
      case 'default_ban_duration':
      case 'notify_ban_action':
        return 'ban';
      case 'default_additional_kick_info':
      case 'require_kick_reason':
      case 'notify_kick_action':
        return 'kick';
      case 'default_additional_mute_info':
      case 'require_mute_reason':
      case 'default_mute_duration':
      case 'notify_mute_action':
        return 'mute';
      case 'default_additional_warn_info':
      case 'require_warn_reason':
      case 'default_warn_duration':
      case 'notify_warn_action':
        return 'warn';
      case 'default_additional_unmute_info':
      case 'require_unmute_reason':
      case 'notify_unmute_action':
        return 'unmute';
      case 'require_unban_reason':
        return 'unban';
    }
  }
}

enum SettingsSubcommandGroup {
  Infractions = 'infractions',
  Permissions = 'permissions',
  Commands = 'commands',
  Lockdown = 'lockdown'
}

enum SettingsSubcommand {
  Toggle = 'toggle',
  ForceReason = 'force-reason',
  SetDefaultDuration = 'set-default-duration',
  SendChannelNotification = 'send-channel-notification',
  SendNotificationDms = 'send-notification-dms',
  TrackNativeInfractions = 'track-native-infractions',
  SetTimeToLive = 'set-time-to-live',
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
  DisplayExecutor = 'display-executor',
  SetAdditionalInfo = 'set-additional-info',
  SetDefaultReplyType = 'set-default-reply-type'
}
