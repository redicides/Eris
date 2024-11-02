import {
  ChatInputCommandInteraction,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  GuildTextBasedChannel,
  CategoryChannel
} from 'discord.js';
import { PermissionEnum } from '@prisma/client';

import ms from 'ms';

import { client, prisma } from '..';
import { parseDuration } from '@utils/index';
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
            description: 'Manage the command settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.Toggle,
                description: 'Enable or disable a command.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'command-name',
                    description: 'The name of the command to enable or disable.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: ConfigSubcommand.TimeToLive,
                description: 'Set the time-to-live for a command responses.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The type of command response to set the time-to-live for.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Command Error', value: 'commandErrorTTL' },
                      { name: 'Command Temporary Response', value: 'commandTemporaryReplyTTL' }
                    ]
                  },
                  {
                    name: 'duration',
                    description: 'The duration for the time-to-live.',
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
            description: 'Manage the report settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.Toggle,
                description: 'Toggle message or user reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'report-type',
                    description: 'The type of report to toggle.',
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
                description: 'Toggle status notifications for a specific report type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'report-type',
                    description: 'The type of the report.',
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
                description: 'Require the user (or auther of a message) to be in the guild to report.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'report-type',
                    description: 'The type of report.',
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
                    description: 'The channel to set as the alert channel.',
                    type: ApplicationCommandOptionType.Channel,
                    channelTypes: [ChannelType.GuildText],
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The type of report to set the alert channel for.',
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
                description: 'Add a role to the immune roles list for a specific report type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role to add to the immune roles list.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The type of report to add the immune role to.',
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
                description: 'Remove a role from the immune roles list for a specific report type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role to remove from the immune roles list.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The type of report to remove the immune role from.',
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
                description: 'Add a role to the ping roles list for a specific report type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role to add to the ping roles list.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The type of report to add the ping role to.',
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
                description: 'Remove a role from the ping roles list for a specific report type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'role',
                    description: 'The role to remove from the ping roles list.',
                    type: ApplicationCommandOptionType.Role,
                    required: true
                  },
                  {
                    name: 'report-type',
                    description: 'The type of report to remove the ping role from.',
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
                description: 'Set the auto disregard duration for a specific report type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'duration',
                    description: 'The duration to set for the auto disregard.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'report-type',
                    description: 'The type of report to set the auto disregard for.',
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
                description: 'Require a reason for accepting or denying a report.',
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
            name: ConfigSubcommandGroup.Infractions,
            description: 'Manage the infraction settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.RequireReason,
                description: 'Require a reason for issuing a certain type of infraction.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: 'The type of infraction to require a reason for.',
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
                description: 'Set the default duration for a certain type of infraction.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'type',
                    description: "The type of infraction to set the default duration for. Use 'none' to reset.",
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
                    description: 'The duration to set as the default.',
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
                    description: 'The type of infraction to toggle notifications for.',
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
            description: 'Manage the logging settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.SetLogChannel,
                description: 'Set the logging channel for a specific log type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'channel',
                    description: 'The channel to set as the logging channel.',
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
                      { name: 'Reports', value: 'reportLoggingWebhook' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.Toggle,
                description: 'Toggle logging for a specific log type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'log-type',
                    description: 'The log type to toggle.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Infractions', value: 'infractionLoggingEnabled' },
                      { name: 'Reports', value: 'reportLoggingEnabled' }
                    ]
                  }
                ]
              }
            ]
          },
          {
            name: ConfigSubcommandGroup.Permissions,
            description: 'Manage the guild permission nodes.',
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
                      { name: 'Manage Message Reports', value: PermissionEnum.ManageMessageReports }
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
                    name: 'node',
                    description: 'The name of the permission node to delete.',
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
                    name: 'node',
                    description: 'The name of the permission node to add the role to.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'role',
                    description: 'The role to add to the permission node.',
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
                    name: 'node',
                    description: 'The name of the permission node to remove the role from.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'role',
                    description: 'The role to remove from the permission node.',
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
                    name: 'node',
                    description: 'The name of the permission node to add the permission to.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'permission',
                    description: 'The permission to add to the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Search Infractions', value: PermissionEnum.SearchInfractions },
                      { name: 'Manage User Reports', value: PermissionEnum.ManageUserReports },
                      { name: 'Manage Message Reports', value: PermissionEnum.ManageMessageReports }
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
                    name: 'node',
                    description: 'The name of the permission node to remove the permission from.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'permission',
                    description: 'The permission to remove from the permission node.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Search Infractions', value: PermissionEnum.SearchInfractions },
                      { name: 'Manage User Reports', value: PermissionEnum.ManageUserReports },
                      { name: 'Manage Message Reports', value: PermissionEnum.ManageMessageReports }
                    ]
                  }
                ]
              }
            ]
          },
          {
            name: ConfigSubcommandGroup.EphemeralScopes,
            description: 'Manage the ephemeral scope settings.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ConfigSubcommand.CreateScope,
                description: 'Create a new ephemeral scope.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'command-name',
                    description: 'The name of the command this scope will apply for.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'include-channel',
                    description: 'The channel or category this scope will apply for.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
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
                    description: 'The name of the scope to delete.',
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
                    description: 'The name of the scope to add the channel to.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'channel',
                    description: 'The channel or category to add to the scope.',
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
                    description: 'The name of the scope to remove the channel from.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'channel',
                    description: 'The channel or category to remove from the scope.',
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
                    description: 'The name of the scope to add the channel to.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'channel',
                    description: 'The channel or category to add to the scope.',
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
                    description: 'The name of the scope to remove the channel from.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'channel',
                    description: 'The channel or category to remove from the scope.',
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildCategory]
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
    config: GuildConfig,
    ephemeral: boolean
  ): Promise<InteractionReplyData> {
    const group = interaction.options.getSubcommandGroup() as ConfigSubcommandGroup;
    const subcommand = interaction.options.getSubcommand() as ConfigSubcommand;

    await interaction.deferReply({ ephemeral });

    switch (group) {
      case ConfigSubcommandGroup.Commands: {
        switch (subcommand) {
          case ConfigSubcommand.Toggle:
            return Config.commands.toggleCommand(interaction, config);
          case ConfigSubcommand.TimeToLive:
            return Config.commands.setTimeToLive(interaction, config);
        }
      }

      case ConfigSubcommandGroup.Reports: {
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

      case ConfigSubcommandGroup.Infractions: {
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

      case ConfigSubcommandGroup.Logging: {
        switch (subcommand) {
          case ConfigSubcommand.SetLogChannel:
            return Config.logging.setChannel(interaction, config);
          case ConfigSubcommand.Toggle:
            return Config.logging.toggleLogging(interaction, config);
        }
      }

      case ConfigSubcommandGroup.Permissions: {
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
        }
      }

      case ConfigSubcommandGroup.EphemeralScopes: {
        switch (subcommand) {
          case ConfigSubcommand.CreateScope:
            return Config.ephemeral.createScope(interaction, config);
          case ConfigSubcommand.DeleteScope:
            return Config.ephemeral.deleteScope(interaction, config);
          case ConfigSubcommand.AddIncludedChannel:
            return Config.ephemeral.addIncludedChannel(interaction, config);
          case ConfigSubcommand.RemoveIncludedChannel:
            return Config.ephemeral.removeIncludedChannel(interaction, config);
          case ConfigSubcommand.AddExcludedChannel:
            return Config.ephemeral.addExcludedChannel(interaction, config);
          case ConfigSubcommand.RemoveExcludedChannel:
            return Config.ephemeral.removeExcludedChannel(interaction, config);
        }
      }
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
      const commandName = interaction.options.getString('command-name', true);

      const command = CommandManager.application_commands.get(commandName);

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
          error: `The time-to-live for this type is already set to **${ms(Math.floor(duration), { long: true })}**.`,
          temporary: true
        };
      }

      await prisma.guild.update({
        where: { id: interaction.guildId },
        data: { [type]: duration }
      });

      return {
        content: `The time-to-live for the specified type has been set to **${ms(Math.floor(duration), {
          long: true
        })}**.`
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

      if (config.nativeModerationIntegration === true) {
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
    async toggleLogging(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
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

    async setChannel(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
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

      if (config.permissions.some(permission => permission.name.toLowerCase() == name)) {
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
      const name = interaction.options.getString('node', true);
      const permission = config.permissions.find(permission => permission.name.toLowerCase() === name);

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
      const name = interaction.options.getString('node', true);
      const role = interaction.options.getRole('role', true);

      const permission = config.permissions.find(permission => permission.name.toLowerCase() === name);

      if (!permission) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (permission.roles.includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the permission node.`,
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
        content: `Successfully added the role ${role.toString()} to the permission node.`
      };
    },

    async removeRoleFromNode(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('node', true);
      const role = interaction.options.getRole('role', true);

      const permission = config.permissions.find(permission => permission.name.toLowerCase() === name);

      if (!permission) {
        return {
          error: `A permission node with that name does not exist.`,
          temporary: true
        };
      }

      if (!permission.roles.includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the permission node.`,
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
        content: `Successfully removed the role ${role.toString()} from the permission node.`
      };
    },

    async addPermission(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('node', true);
      const permission = interaction.options.getString('permission', true) as PermissionEnum;

      const permissionNode = config.permissions.find(permission => permission.name.toLowerCase() === name);

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
          permissions: [...config.permissions, permissionNode]
        }
      });

      return {
        content: `Successfully added the permission \`${permission}\` to the permission node.`
      };
    },

    async removePermission(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const name = interaction.options.getString('node', true);
      const permission = interaction.options.getString('permission', true) as PermissionEnum;

      const permissionNode = config.permissions.find(permission => permission.name.toLowerCase() === name);

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
          permissions: [...config.permissions, permissionNode]
        }
      });

      return {
        content: `Successfully removed the permission \`${permission}\` from the permission node.`
      };
    }
  };

  private static ephemeral = {
    async createScope(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const commandName = interaction.options.getString('command-name', true);
      const includeChannel = interaction.options.getChannel('include-channel', true) as
        | GuildTextBasedChannel
        | CategoryChannel;

      const excludeChannel = interaction.options.getChannel('exclude-channel') as
        | GuildTextBasedChannel
        | CategoryChannel
        | null;

      if (config.ephemeralScopes.some(scope => scope.commandName === commandName)) {
        return {
          error: `An ephemeral scope for the command \`${commandName}\` already exists.`,
          temporary: true
        };
      }

      if (excludeChannel?.id === includeChannel.id) {
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
              commandName,
              includedChannels: [includeChannel.id],
              excludedChannels: excludeChannel ? [excludeChannel.id] : []
            }
          }
        }
      });

      return {
        content: `Successfully created the ephemeral scope for the command \`${commandName}\`.`
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
    }
  };
}

enum ConfigSubcommandGroup {
  Commands = 'commands',
  Reports = 'reports',
  Infractions = 'infractions',
  Logging = 'logging',
  Permissions = 'permissions',
  EphemeralScopes = 'ephemeral-scopes'
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
  AddRoleToNode = 'add-role-to-node',
  RemoveRoleFromNode = 'remove-role-from-node',
  GrantPermission = 'grant',
  RevokePermission = 'revoke',
  CreateScope = 'create',
  DeleteScope = 'delete',
  AddIncludedChannel = 'add-included-channel',
  RemoveIncludedChannel = 'remove-included-channel',
  AddExcludedChannel = 'add-excluded-channel',
  RemoveExcludedChannel = 'remove-excluded-channel'
}

const isCategory = (channel: GuildTextBasedChannel | CategoryChannel): boolean => channel instanceof CategoryChannel;
