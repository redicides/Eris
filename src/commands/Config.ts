import {
  ChatInputCommandInteraction,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  GuildTextBasedChannel,
  CategoryChannel,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  AttachmentBuilder
} from 'discord.js';
import { PermissionEnum } from '@prisma/client';

import ms from 'ms';

import { client, prisma } from '..';
import { parseDuration, pluralize, uploadData } from '@utils/index';
import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';
import CommandManager from '@managers/commands/CommandManager';

export default class Config extends Command {
  constructor() {
    super({
      category: CommandCategory.Management,
      data: {
        name: 'config',
        description: 'Manage the guild configuration.',
        type: ApplicationCommandType.ChatInput,
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        options: [
          {
            name: ConfigSubcommandGroup.Commands,
            description: 'Command settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.Toggle,
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
              }
            ]
          },
          {
            name: ConfigSubcommandGroup.Reports,
            description: 'Report settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.Toggle,
                description: 'Toggle reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsEnabled' },
                      { name: 'Message Report', value: 'messageReportsEnabled' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.ToggleNotifications,
                description: 'Toggle status notifications.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsNotifyStatus' },
                      { name: 'Message Report', value: 'messageReportsNotifyStatus' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.RequireMember,
                description: 'Require members for reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsRequireMember' },
                      { name: 'Message Report', value: 'messageReportsRequireMember' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.SetAlertChannel,
                description: 'Set the alert channel for reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel.',
                    type: ApplicationCommandOptionType.Channel,
                    channelTypes: [ChannelType.GuildText],
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsWebhook' },
                      { name: 'Message Report', value: 'messageReportsWebhook' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.AddImmuneRole,
                description: 'Make a role immune to reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsImmuneRoles' },
                      { name: 'Message Report', value: 'messageReportsImmuneRoles' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.RemoveImmuneRole,
                description: 'Make a role not immune to reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsImmuneRoles' },
                      { name: 'Message Report', value: 'messageReportsImmuneRoles' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.AddPingRole,
                description: 'Add a role to the ping roles list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsPingRoles' },
                      { name: 'Message Report', value: 'messageReportsPingRoles' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.RemovePingRole,
                description: 'Remove a role from the ping roles list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsPingRoles' },
                      { name: 'Message Report', value: 'messageReportsPingRoles' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.SetAutoDisregard,
                description: 'Set the auto disregard duration for reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'duration',
                    description: 'The duration.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'userReportsDisregardAfter' },
                      { name: 'Message Report', value: 'messageReportsDisregardAfter' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.RequireReviewReason,
                description: 'Require a reason for managing reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'action-type',
                    description: 'The action to require a reason for.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report Accept', value: 'userReportsRequireAcceptReason' },
                      { name: 'User Report Deny', value: 'userReportsRequireDenyReason' },
                      { name: 'Message Report Accept', value: 'messageReportsRequireAcceptReason' },
                      { name: 'Message Report Deny', value: 'messageReportsRequireDenyReason' }
                    ]
                  }
                ]
              }
            ]
          },
          {
            name: ConfigSubcommandGroup.Requests,
            description: 'Request settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.Toggle,
                description: 'Toggle requests.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'request-type',
                    description: 'The request type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Mute Request', value: 'muteRequestsEnabled' },
                      { name: 'Ban Request', value: 'banRequestsEnabled' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.SetAlertChannel,
                description: 'Set the alert channel.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel.',
                    type: ApplicationCommandOptionType.Channel,
                    channelTypes: [ChannelType.GuildText],
                    required: true
                  },
                  {
                    name: 'request-type',
                    description: 'The request type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Mute Request', value: 'muteRequestsWebhook' },
                      { name: 'Ban Request', value: 'banRequestsWebhook' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.AddImmuneRole,
                description: 'Add a role to the immune roles list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role to add.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'request-type',
                    description: 'The request type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Mute Request', value: 'muteRequestsImmuneRoles' },
                      { name: 'Ban Request', value: 'banRequestsImmuneRoles' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.RemoveImmuneRole,
                description: 'Remove a role from the immune roles list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role to remove.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'request-type',
                    description: 'The request type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Mute Request', value: 'muteRequestsImmuneRoles' },
                      { name: 'Ban Request', value: 'banRequestsImmuneRoles' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.AddPingRole,
                description: 'Add a role to the ping roles list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role to add.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'request-type',
                    description: 'The request type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Mute Request', value: 'muteRequestsPingRoles' },
                      { name: 'Ban Request', value: 'banRequestsPingRoles' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.RemovePingRole,
                description: 'Remove a role from the ping roles list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role to remove.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'request-type',
                    description: 'The type of request to remove the ping role from.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Mute Request', value: 'muteRequestsPingRoles' },
                      { name: 'Ban Request', value: 'banRequestsPingRoles' }
                    ]
                  }
                ]
              }
            ]
          },
          {
            name: ConfigSubcommandGroup.Infractions,
            description: 'Infraction settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.RequireReason,
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
                name: ConfigSubcommand.SetDefaultDuration,
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
                name: ConfigSubcommand.ToggleNotifications,
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
                name: ConfigSubcommand.ToggleNativeIntegration,
                description: 'Toggle tracking of infractions from native moderation.',
                type: ApplicationCommandOptionType.Subcommand
              }
            ]
          },
          {
            name: ConfigSubcommandGroup.Logging,
            description: 'Logging settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.SetNotificationChannel,
                description: 'Set the public notification channel.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel.',
                    type: ApplicationCommandOptionType.Channel,
                    channelTypes: [ChannelType.GuildText],
                    required: true
                  }
                ]
              },
              {
                name: ConfigSubcommand.SetLogChannel,
                description: 'Set the logging channel for a log type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel.',
                    type: ApplicationCommandOptionType.Channel,
                    channelTypes: [ChannelType.GuildText],
                    required: true
                  },
                  {
                    name: 'log-type',
                    description: 'The logs to send to the channel.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Infractions', value: 'infractionLoggingWebhook' },
                      { name: 'Reports', value: 'reportLoggingWebhook' },
                      { name: 'Requests', value: 'requestLoggingWebhook' },
                      { name: 'Messages', value: 'messageLoggingWebhook' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.Toggle,
                description: 'Toggle logging.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'log-type',
                    description: 'The log type to toggle.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Infractions', value: 'infractionLoggingEnabled' },
                      { name: 'Reports', value: 'reportLoggingEnabled' },
                      { name: 'Requests', value: 'requestLoggingEnabled' },
                      { name: 'Messages', value: 'messageLoggingEnabled' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.AddIgnoredChannel,
                description: 'Ignore a channel for a specific log type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channelTypes: [ChannelType.GuildText, ChannelType.GuildCategory]
                  },
                  {
                    name: 'log-type',
                    description: 'The log type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [{ name: 'Messages', value: 'messageLoggingIgnoredChannels' }]
                  }
                ]
              },
              {
                name: ConfigSubcommand.RemoveIgnoredChannel,
                description: 'Remove a channel from the ignored channels list.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channelTypes: [ChannelType.GuildText, ChannelType.GuildCategory]
                  },
                  {
                    name: 'log-type',
                    description: 'The log type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [{ name: 'Messages', value: 'messageLoggingIgnoredChannels' }]
                  }
                ]
              },
              {
                name: ConfigSubcommand.ListIgnoredChannels,
                description: 'List all the ignored channels for a specific log type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'log-type',
                    description: 'The log type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [{ name: 'Messages', value: 'messageLoggingIgnoredChannels' }]
                  }
                ]
              }
            ]
          },
          {
            name: ConfigSubcommandGroup.Permissions,
            description: 'Permission settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.CreateNode,
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
                      { name: 'Update Infractions', value: PermissionEnum.UpdateInfractions }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.DeleteNode,
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
                name: ConfigSubcommand.AddRoleToNode,
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
                name: ConfigSubcommand.RemoveRoleFromNode,
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
                name: ConfigSubcommand.GrantPermission,
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
                      { name: 'Update Infractions', value: PermissionEnum.UpdateInfractions }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.RevokePermission,
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
                      { name: 'Update Infractions', value: PermissionEnum.UpdateInfractions }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.ListNodes,
                description: 'List all the permission nodes.',
                type: ApplicationCommandOptionType.Subcommand
              }
            ]
          },
          {
            name: ConfigSubcommandGroup.Interactions,
            description: 'Interaction settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.ToggleDefaultEphemeralReply,
                description: 'Toggle default ephemeral replies.',
                type: ApplicationCommandOptionType.Subcommand
              },
              {
                name: ConfigSubcommand.TimeToLive,
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
                name: ConfigSubcommand.CreateScope,
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
                name: ConfigSubcommand.DeleteScope,
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
                name: ConfigSubcommand.AddIncludedChannel,
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
                name: ConfigSubcommand.RemoveIncludedChannel,
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
                name: ConfigSubcommand.AddExcludedChannel,
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
                name: ConfigSubcommand.RemoveExcludedChannel,
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
                name: ConfigSubcommand.List,
                description: 'List all the ephemeral scopes.',
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
    const group = interaction.options.getSubcommandGroup() as ConfigSubcommandGroup;
    const subcommand = interaction.options.getSubcommand() as ConfigSubcommand;

    await interaction.deferReply({ ephemeral });

    switch (group) {
      case ConfigSubcommandGroup.Commands:
        {
          switch (subcommand) {
            case ConfigSubcommand.Toggle:
              return Config.commands.toggleCommand(interaction, config);
          }
        }

        break;

      case ConfigSubcommandGroup.Reports:
        {
          switch (subcommand) {
            case ConfigSubcommand.Toggle:
              return Config.reports.toggleReport(interaction, config);
            case ConfigSubcommand.ToggleNotifications:
              return Config.reports.toggleNotifications(interaction, config);
            case ConfigSubcommand.RequireMember:
              return Config.reports.requireMember(interaction, config);
            case ConfigSubcommand.SetAlertChannel:
              return Config.reports.setAlertChannel(interaction, config);
            case ConfigSubcommand.AddImmuneRole:
              return Config.reports.addImmuneRole(interaction);
            case ConfigSubcommand.RemoveImmuneRole:
              return Config.reports.removeImmuneRole(interaction);
            case ConfigSubcommand.AddPingRole:
              return Config.reports.addPingRole(interaction);
            case ConfigSubcommand.RemovePingRole:
              return Config.reports.removePingRole(interaction);
            case ConfigSubcommand.SetAutoDisregard:
              return Config.reports.setAutoDisregard(interaction, config);
            case ConfigSubcommand.RequireReviewReason:
              return Config.reports.requireReviewReason(interaction, config);
          }
        }

        break;

      case ConfigSubcommandGroup.Requests:
        {
          switch (subcommand) {
            case ConfigSubcommand.Toggle:
              return Config.requests.toggleRequest(interaction, config);
            case ConfigSubcommand.SetAlertChannel:
              return Config.requests.setAlertChannel(interaction, config);
            case ConfigSubcommand.AddImmuneRole:
              return Config.requests.addImmuneRole(interaction);
            case ConfigSubcommand.RemoveImmuneRole:
              return Config.requests.removeImmuneRole(interaction);
            case ConfigSubcommand.AddPingRole:
              return Config.requests.addPingRole(interaction);
            case ConfigSubcommand.RemovePingRole:
              return Config.requests.removePingRole(interaction);
          }
        }

        break;

      case ConfigSubcommandGroup.Infractions:
        {
          switch (subcommand) {
            case ConfigSubcommand.RequireReason:
              return Config.infractions.requireReason(interaction, config);
            case ConfigSubcommand.SetDefaultDuration:
              return Config.infractions.setDefaultDuration(interaction, config);
            case ConfigSubcommand.ToggleNotifications:
              return Config.infractions.toggleNotifications(interaction, config);
            case ConfigSubcommand.ToggleNativeIntegration:
              return Config.infractions.toggleNativeIntegration(interaction, config);
          }
        }

        break;

      case ConfigSubcommandGroup.Logging:
        {
          switch (subcommand) {
            case ConfigSubcommand.SetLogChannel:
              return Config.logging.setChannel(interaction, config);
            case ConfigSubcommand.SetNotificationChannel:
              return Config.logging.setNotificationChannel(interaction, config);
            case ConfigSubcommand.Toggle:
              return Config.logging.toggleLogging(interaction, config);
            case ConfigSubcommand.AddIgnoredChannel:
              return Config.logging.addIgnoredChannel(interaction);
            case ConfigSubcommand.RemoveIgnoredChannel:
              return Config.logging.removeIgnoredChannel(interaction);
            case ConfigSubcommand.ListIgnoredChannels:
              return Config.logging.listIgnoredChannels(interaction);
          }
        }

        break;

      case ConfigSubcommandGroup.Permissions:
        {
          switch (subcommand) {
            case ConfigSubcommand.CreateNode:
              return Config.permissions.createNode(interaction, config);
            case ConfigSubcommand.DeleteNode:
              return Config.permissions.deleteNode(interaction, config);
            case ConfigSubcommand.AddRoleToNode:
              return Config.permissions.addRoleToNode(interaction, config);
            case ConfigSubcommand.RemoveRoleFromNode:
              return Config.permissions.removeRoleFromNode(interaction, config);
            case ConfigSubcommand.GrantPermission:
              return Config.permissions.addPermission(interaction, config);
            case ConfigSubcommand.RevokePermission:
              return Config.permissions.removePermission(interaction, config);
            case ConfigSubcommand.ListNodes:
              return Config.permissions.listNodes(interaction, config);
          }
        }

        break;

      case ConfigSubcommandGroup.Interactions:
        {
          switch (subcommand) {
            case ConfigSubcommand.CreateScope:
              return Config.interactions.createScope(interaction, config);
            case ConfigSubcommand.DeleteScope:
              return Config.interactions.deleteScope(interaction, config);
            case ConfigSubcommand.AddIncludedChannel:
              return Config.interactions.addIncludedChannel(interaction, config);
            case ConfigSubcommand.RemoveIncludedChannel:
              return Config.interactions.removeIncludedChannel(interaction, config);
            case ConfigSubcommand.AddExcludedChannel:
              return Config.interactions.addExcludedChannel(interaction, config);
            case ConfigSubcommand.RemoveExcludedChannel:
              return Config.interactions.removeExcludedChannel(interaction, config);
            case ConfigSubcommand.List:
              return Config.interactions.list(interaction, config);
            case ConfigSubcommand.ToggleDefaultEphemeralReply:
              return Config.interactions.toggle(config);
            case ConfigSubcommand.TimeToLive:
              return Config.interactions.setTimeToLive(interaction, config);
          }
        }

        break;
    }

    return {
      error: 'An unknown error occurred.',
      temporary: true
    };
  }

  private static commands = {
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
    }
  };

  private static reports = {
    async requireMember(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      let toggle = true;

      if (config[type] === true) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `${type === 'messageReportsRequireMember' ? 'Message authors' : 'Users'} must ${
          toggle ? 'now' : 'no longer'
        } be in the guild to submit a report.`
      };
    },

    async toggleNotifications(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      let toggle = true;

      if (config[type] === true) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `Users will ${toggle ? 'now' : 'no longer'} receive status notifications for ${
          type === 'messageReportsNotifyStatus' ? 'message reports' : 'user reports'
        }.`
      };
    },

    async toggleReport(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      let toggle = true;

      if (config[type] === true) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `Users can now ${toggle ? 'report' : 'no longer report'} ${
          type === 'messageReportsEnabled' ? 'messages' : 'other users'
        }.`
      };
    },

    async setAlertChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      const webhooks = await interaction.guild.fetchWebhooks();
      const webhook = webhooks.find(webhook => webhook.url === config[type]);

      if (
        !channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageWebhooks) ||
        !interaction.appPermissions.has(PermissionFlagsBits.ManageWebhooks)
      ) {
        return {
          error: 'I must have the `Manage Webhooks` permission to perform this action.',
          temporary: true
        };
      }

      if (webhook) {
        if (webhook.channelId === channel.id) {
          return {
            error: `The alert channel for ${
              type === 'messageReportsWebhook' ? 'message reports' : 'user reports'
            } is already set to ${channel.toString()}.`,
            temporary: true
          };
        }

        let failed = false;

        await webhook
          .edit({
            channel: channel.id
          })
          .catch(() => {
            failed = true;
          });

        if (failed) {
          return {
            error: 'Failed to update the alert channel.',
            temporary: true
          };
        }
      } else {
        let failed = false;

        const newWebhook = await channel
          .createWebhook({
            name: `${type === 'messageReportsWebhook' ? 'Message' : 'User'} Report Alerts`,
            avatar: client.user!.displayAvatarURL()
          })
          .catch(() => {
            failed = true;
          });

        if (failed || !newWebhook) {
          return {
            error: `Failed to create a new webhook in ${channel.toString()}.`,
            temporary: true
          };
        }

        await prisma.guild.update({
          where: { id: interaction.guildId },
          data: { [type]: newWebhook.url }
        });
      }

      return {
        content: `The alert channel for ${
          type === 'messageReportsWebhook' ? 'message reports' : 'user reports'
        } has been set to ${channel.toString()}.`
      };
    },

    async addImmuneRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          userReportsImmuneRoles: true,
          messageReportsImmuneRoles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      if (config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the immune roles list for ${
            type === 'messageReportsImmuneRoles' ? 'message reports' : 'user reports'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { push: role.id } }
      });

      return {
        content: `The role ${role.toString()} has been added to the immune roles list for ${
          type === 'messageReportsImmuneRoles' ? 'message reports' : 'user reports'
        }.`
      };
    },

    async removeImmuneRole(interaction: ChatInputCommandInteraction<'cached'>) {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          userReportsImmuneRoles: true,
          messageReportsImmuneRoles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      if (!config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the immune roles list for ${
            type === 'messageReportsImmuneRoles' ? 'message reports' : 'user reports'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { set: config[type].filter(r => r !== role.id) } }
      });

      return {
        content: `The role ${role.toString()} has been removed from the immune roles list for ${
          type === 'messageReportsImmuneRoles' ? 'message reports' : 'user reports'
        }.`
      };
    },

    async addPingRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          userReportsPingRoles: true,
          messageReportsPingRoles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      if (config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the ping roles list for ${
            type === 'messageReportsPingRoles' ? 'message reports' : 'user reports'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { push: role.id } }
      });

      return {
        content: `The role ${role.toString()} has been added to the ping roles list for ${
          type === 'messageReportsPingRoles' ? 'message reports' : 'user reports'
        }.`
      };
    },

    async removePingRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          userReportsPingRoles: true,
          messageReportsPingRoles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      if (!config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the ping roles list for ${
            type === 'messageReportsPingRoles' ? 'message reports' : 'user reports'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { set: config[type].filter(r => r !== role.id) } }
      });

      return {
        content: `The role ${role.toString()} has been removed from the ping roles list for ${
          type === 'messageReportsPingRoles' ? 'message reports' : 'user reports'
        }.`
      };
    },

    async setAutoDisregard(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
      const rawDuration = interaction.options.getString('duration', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      const duration = parseDuration(rawDuration);

      if (!duration || isNaN(duration)) {
        return {
          error: 'Invalid duration. The valid format is `<number>[s/m/h/d]` (`<number> [second/minute/hour/day]`).',
          temporary: true
        };
      }

      if (duration < 1000) {
        return {
          error: 'The duration must be at least 1 second.',
          temporary: true
        };
      }

      if (duration > ms('365d')) {
        return {
          error: 'The duration must not exceed 1 year.',
          temporary: true
        };
      }

      if (config[type] === duration) {
        return {
          error: `The auto disregard duration for this type is already set to **${ms(Math.floor(duration), {
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
        content: `The auto disregard duration for the specified type has been set to **${ms(Math.floor(duration), {
          long: true
        })}**.`
      };
    },

    async requireReviewReason(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('action-type', true) as keyof typeof config;

      let toggle = true;

      if (config[type] === true) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `A reason is ${toggle ? 'now' : 'no longer'} required for ${
          type.includes('Accept') ? 'accepting' : 'denying'
        } ${type.includes('user') ? 'user reports' : 'message reports'}.`
      };
    }
  };

  private static requests = {
    async toggleRequest(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      let toggle = true;

      if (config[type] === true) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `Moderators can now ${toggle ? 'submit' : 'no longer submit'} ${
          type === 'muteRequestsEnabled' ? 'mute requests' : 'ban requests'
        }.`
      };
    },

    async setAlertChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      const webhooks = await interaction.guild.fetchWebhooks();
      const webhook = webhooks.find(webhook => webhook.url === config[type]);

      if (
        !channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageWebhooks) ||
        !interaction.appPermissions.has(PermissionFlagsBits.ManageWebhooks)
      ) {
        return {
          error: 'I must have the `Manage Webhooks` permission to perform this action.',
          temporary: true
        };
      }

      if (webhook) {
        if (webhook.channelId === channel.id) {
          return {
            error: `The alert channel for ${
              type === 'muteRequestsWebhook' ? 'mute requests' : 'ban requests'
            } is already set to ${channel.toString()}.`,
            temporary: true
          };
        }

        let failed = false;

        await webhook
          .edit({
            channel: channel.id
          })
          .catch(() => {
            failed = true;
          });

        if (failed) {
          return {
            error: 'Failed to update the alert channel.',
            temporary: true
          };
        }
      } else {
        let failed = false;

        const newWebhook = await channel
          .createWebhook({
            name: `${type === 'muteRequestsWebhook' ? 'Mute' : 'Ban'} Request Alerts`,
            avatar: client.user!.displayAvatarURL()
          })
          .catch(() => {
            failed = true;
          });

        if (failed || !newWebhook) {
          return {
            error: `Failed to create a new webhook in ${channel.toString()}.`,
            temporary: true
          };
        }

        await prisma.guild.update({
          where: { id: interaction.guildId },
          data: { [type]: newWebhook.url }
        });
      }

      return {
        content: `The alert channel for ${
          type === 'muteRequestsWebhook' ? 'mute requests' : 'ban requests'
        } has been set to ${channel.toString()}.`
      };
    },

    async addImmuneRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          muteRequestsImmuneRoles: true,
          banRequestsImmuneRoles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      if (config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the immune roles list for ${
            type === 'muteRequestsImmuneRoles' ? 'mute requests' : 'ban requests'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { push: role.id } }
      });

      return {
        content: `The role ${role.toString()} has been added to the immune roles list for ${
          type === 'muteRequestsImmuneRoles' ? 'mute requests' : 'ban requests'
        }.`
      };
    },

    async removeImmuneRole(interaction: ChatInputCommandInteraction<'cached'>) {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          muteRequestsImmuneRoles: true,
          banRequestsImmuneRoles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      if (!config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the immune roles list for ${
            type === 'muteRequestsImmuneRoles' ? 'mute requests' : 'ban requests'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { set: config[type].filter(r => r !== role.id) } }
      });

      return {
        content: `The role ${role.toString()} has been removed from the immune roles list for ${
          type === 'muteRequestsImmuneRoles' ? 'mute requests' : 'ban requests'
        }.`
      };
    },

    async addPingRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          muteRequestsPingRoles: true,
          banRequestsPingRoles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      if (config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the ping roles list for ${
            type === 'muteRequestsPingRoles' ? 'mute requests' : 'ban requests'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { push: role.id } }
      });

      return {
        content: `The role ${role.toString()} has been added to the ping roles list for ${
          type === 'muteRequestsPingRoles' ? 'mute requests' : 'ban requests'
        }.`
      };
    },

    async removePingRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          muteRequestsPingRoles: true,
          banRequestsPingRoles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      if (!config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the ping roles list for ${
            type === 'muteRequestsPingRoles' ? 'mute requests' : 'ban requests'
          }.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { set: config[type].filter(r => r !== role.id) } }
      });

      return {
        content: `The role ${role.toString()} has been removed from the ping roles list for ${
          type === 'muteRequestsPingRoles' ? 'mute requests' : 'ban requests'
        }.`
      };
    }
  };

  private static infractions = {
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

  private static logging = {
    async toggleLogging(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      let toggle = true;

      if (config[type] === true) {
        toggle = false;
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: toggle }
      });

      return {
        content: `Logging for the specified type has been ${toggle ? 'enabled' : 'disabled'}.`
      };
    },

    async setChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      const webhooks = await interaction.guild.fetchWebhooks();
      const webhook = webhooks.find(webhook => webhook.url === config[type]);

      if (
        !channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageWebhooks) ||
        !interaction.appPermissions.has(PermissionFlagsBits.ManageWebhooks)
      ) {
        return {
          error: 'I must have the `Manage Webhooks` permission to perform this action.',
          temporary: true
        };
      }

      if (webhook) {
        if (webhook.channelId === channel.id) {
          return {
            error: `The log channel for the specified type is already set to ${channel.toString()}.`,
            temporary: true
          };
        }

        let failed = false;

        await webhook
          .edit({
            channel: channel.id
          })
          .catch(() => {
            failed = true;
          });

        if (failed) {
          return {
            error: 'Failed to update the log channel.',
            temporary: true
          };
        }
      } else {
        let failed = false;

        const newWebhook = await channel
          .createWebhook({
            name: `Charmie`,
            avatar: client.user!.displayAvatarURL()
          })
          .catch(() => {
            failed = true;
          });

        if (failed || !newWebhook) {
          return {
            error: `Failed to create a new webhook in ${channel.toString()}.`,
            temporary: true
          };
        }

        await prisma.guild.update({
          where: { id: interaction.guildId },
          data: { [type]: newWebhook.url }
        });
      }

      return {
        content: `The log channel for the specified type has been set to ${channel.toString()}.`
      };
    },

    async setNotificationChannel(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;

      const webhooks = await interaction.guild.fetchWebhooks();
      const webhook = webhooks.find(webhook => webhook.url === config.notificationWebhook);

      if (
        !channel.permissionsFor(interaction.guild.members.me!).has(PermissionFlagsBits.ManageWebhooks) ||
        !interaction.appPermissions.has(PermissionFlagsBits.ManageWebhooks)
      ) {
        return {
          error: 'I must have the `Manage Webhooks` permission to perform this action.',
          temporary: true
        };
      }

      if (webhook) {
        if (webhook.channelId === channel.id) {
          return {
            error: `The notification channel is already set to ${channel}.`,
            temporary: true
          };
        }

        let failed = false;

        await webhook
          .edit({
            channel: channel.id
          })
          .catch(() => {
            failed = true;
          });

        if (failed) {
          return {
            error: 'Failed to update the notification channel.',
            temporary: true
          };
        }
      } else {
        let failed = false;

        const newWebhook = await channel
          .createWebhook({
            name: `Charmie`,
            avatar: client.user!.displayAvatarURL()
          })
          .catch(() => {
            failed = true;
          });

        if (failed || !newWebhook) {
          return {
            error: `Failed to create a new webhook in ${channel}.`,
            temporary: true
          };
        }

        await prisma.guild.update({
          where: { id: interaction.guildId },
          data: { notificationWebhook: newWebhook.url }
        });
      }

      return {
        content: `The notification channel has been set to ${channel}.`
      };
    },

    async addIgnoredChannel(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: { id: interaction.guildId },
        select: { messageLoggingIgnoredChannels: true }
      }))!;

      const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | CategoryChannel;
      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      if (config[type].includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is already in the ignored channels list for the specified type.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { push: channel.id } }
      });

      return {
        content: `The ${
          isCategory(channel) ? 'category' : 'channel'
        } ${channel} has been added to the ignored channels list for the specified type.`
      };
    },

    async removeIgnoredChannel(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: { id: interaction.guildId },
        select: { messageLoggingIgnoredChannels: true }
      }))!;

      const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | CategoryChannel;
      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      if (!config[type].includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is not in the ignored channels list for the specified type.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: { set: config[type].filter(c => c !== channel.id) } }
      });

      return {
        content: `The ${
          isCategory(channel) ? 'category' : 'channel'
        } ${channel} has been removed from the ignored channels list for the specified type.`
      };
    },

    async listIgnoredChannels(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: { id: interaction.guildId },
        select: { messageLoggingIgnoredChannels: true }
      }))!;

      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      if (!config[type].length) {
        return {
          content: `There are currently no ignored for the specified log type.`,
          temporary: true
        };
      }

      const channels = await Promise.all(
        config[type].map(async id => {
          const channel = (await interaction.guild.channels
            .fetch(id)
            .catch(() => null)) as GuildTextBasedChannel | null;
          return { channel: channel, channelId: id, isCategory: channel ? isCategory(channel) : false };
        })
      );

      const map = channels
        .map(channels => {
          return channels.channel
            ? `- ${channels.isCategory ? 'Category' : 'Channel'} "#${channels.channel.name}" (${channels.channelId})`
            : `- Unknown channel "<#${channels.channelId}>"`;
        })
        .join('\n');

      const dataUrl = await uploadData(map, 'txt');
      const buffer = Buffer.from(map, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'ignored-channels.txt' });

      const urlButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open in Browser').setURL(dataUrl);
      const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton);

      return {
        content: `There are currently **${config[type].length}** ignored channels for the specified log type.`,
        files: [attachment],
        components: [actionRow]
      };
    }
  };

  private static permissions = {
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
          permissions: [...config.permissions, permission]
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
          permissions: [...config.permissions, permission]
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
          error: `The permission \`${permission}\` is already in the permission node.`,
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
          error: `The permission \`${permission}\` is not in the permission node.`,
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

  private static interactions = {
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
          } ${channel} ${channel.toString()} is already in the included channels list for the scope.`,
          temporary: true
        };
      }

      if (scope.excludedChannels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} ${channel.toString()} is in the excluded channels list for the scope. Remove it from the excluded channels list first.`,
          temporary: true
        };
      }

      scope.includedChannels.push(channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: [...config.ephemeralScopes, scope]
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
          } ${channel} ${channel.toString()} is not in the included channels list for the scope.`,
          temporary: true
        };
      }

      scope.includedChannels = scope.includedChannels.filter(c => c !== channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: [...config.ephemeralScopes, scope]
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
          } ${channel} ${channel.toString()} is already in the excluded channels list for the scope.`,
          temporary: true
        };
      }

      if (scope.includedChannels.includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} ${channel.toString()} is in the included channels list for the scope. Remove it from the included channels list first.`,
          temporary: true
        };
      }

      scope.excludedChannels.push(channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: [...config.ephemeralScopes, scope]
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
          } ${channel} ${channel.toString()} is not in the excluded channels list for the scope.`,
          temporary: true
        };
      }

      scope.excludedChannels = scope.excludedChannels.filter(c => c !== channel.id);

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: {
          ephemeralScopes: [...config.ephemeralScopes, scope]
        }
      });

      return {
        content: `Successfully removed the ${
          isCategory(channel) ? 'category' : 'channel'
        } ${channel} from the excluded channels list for the scope.`
      };
    },

    async list(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig): Promise<InteractionReplyData> {
      if (config.ephemeralScopes.length < 1) {
        return {
          content: 'There are no ephemeral scopes set up in this server.'
        };
      }

      const map = await Promise.all(
        config.ephemeralScopes.map(async scope => {
          const includedChannels = await Promise.all(
            scope.includedChannels.map(async id => {
              const channel = await interaction.guild!.channels.fetch(id).catch(() => null);
              return channel ? `#${channel.name} (${id})` : `<#${id}>`;
            })
          );

          const excludedChannels = await Promise.all(
            scope.excludedChannels.map(async id => {
              const channel = await interaction.guild!.channels.fetch(id).catch(() => null);
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

    async toggle(config: GuildConfig): Promise<InteractionReplyData> {
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
}

enum ConfigSubcommandGroup {
  Commands = 'commands',
  Reports = 'reports',
  Requests = 'requests',
  Infractions = 'infractions',
  Logging = 'logging',
  Permissions = 'permissions',
  Interactions = 'interactions'
}

enum ConfigSubcommand {
  Toggle = 'toggle',
  ToggleNotifications = 'toggle-notifications',
  ToggleNativeIntegration = 'toggle-native-integration',
  TimeToLive = 'time-to-live',
  SetAlertChannel = 'set-alert-channel',
  AddImmuneRole = 'add-immune-role',
  AddPingRole = 'add-ping-role',
  RemoveImmuneRole = 'remove-immune-role',
  RemovePingRole = 'remove-ping-role',
  SetAutoDisregard = 'set-auto-disregard',
  RequireMember = 'require-member',
  RequireReviewReason = 'require-review-reason',
  RequireReason = 'require-reason',
  SetDefaultDuration = 'set-default-duration',
  SetLogChannel = 'set-channel',
  CreateNode = 'create-node',
  DeleteNode = 'delete-node',
  ListNodes = 'list',
  AddRoleToNode = 'add-role-to-node',
  RemoveRoleFromNode = 'remove-role-from-node',
  GrantPermission = 'grant',
  RevokePermission = 'revoke',
  CreateScope = 'create-ephemeral-scope',
  DeleteScope = 'delete-ephemeral-scope',
  AddIncludedChannel = 'add-included-channel',
  RemoveIncludedChannel = 'remove-included-channel',
  AddExcludedChannel = 'add-excluded-channel',
  RemoveExcludedChannel = 'remove-excluded-channel',
  List = 'list-ephemeral-scopes',
  AddIgnoredChannel = 'add-ignored-channel',
  RemoveIgnoredChannel = 'remove-ignored-channel',
  ListIgnoredChannels = 'list-ignored-channels',
  ToggleDefaultEphemeralReply = 'toggle-default-ephemeral-reply',
  SetNotificationChannel = 'set-notification-channel'
}

const isCategory = (channel: GuildTextBasedChannel | CategoryChannel): boolean => channel instanceof CategoryChannel;
