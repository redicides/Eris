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

import ms from 'ms';

import { client, prisma } from '..';
import { capitalize, isEphemeralReply, parseDuration, uploadData } from '@utils/index';
import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Command, { CommandCategory } from '@terabyte/Command';

export default class Config extends Command {
  constructor() {
    super({
      category: CommandCategory.Management,
      data: {
        name: 'config',
        description: 'Configure features for this server.',
        type: ApplicationCommandType.ChatInput,
        // defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        options: [
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
                      { name: 'User Report', value: 'user_reports_enabled' },
                      { name: 'Message Report', value: 'message_reports_enabled' }
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
                      { name: 'User Report', value: 'user_reports_notify_status' },
                      { name: 'Message Report', value: 'message_reports_notify_status' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.ForceMember,
                description: 'Force report targets to be in the guild.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'report-type',
                    description: 'The report type.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report', value: 'user_reports_require_member' },
                      { name: 'Message Report', value: 'message_reports_require_member' }
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
                      { name: 'User Report', value: 'user_reports_webhook' },
                      { name: 'Message Report', value: 'message_reports_webhook' }
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
                      { name: 'User Report', value: 'user_reports_immune_roles' },
                      { name: 'Message Report', value: 'message_reports_immune_roles' }
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
                      { name: 'User Report', value: 'user_reports_immune_roles' },
                      { name: 'Message Report', value: 'message_reports_immune_roles' }
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
                      { name: 'User Report', value: 'user_reports_ping_roles' },
                      { name: 'Message Report', value: 'message_reports_ping_roles' }
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
                      { name: 'User Report', value: 'user_reports_ping_roles' },
                      { name: 'Message Report', value: 'message_reports_ping_roles' }
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
                      { name: 'User Report', value: 'user_reports_disregard_after' },
                      { name: 'Message Report', value: 'message_reports_disregard_after' }
                    ]
                  }
                ]
              },
              {
                name: ConfigSubcommand.ForceReviewReason,
                description: 'Force reviewers to submit a reason when managing reports.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'action-type',
                    description: 'The action to require a reason for.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'User Report Accept', value: 'user_reports_require_accept_reason' },
                      { name: 'User Report Deny', value: 'user_reports_require_deny_reason' },
                      { name: 'Message Report Accept', value: 'message_reports_require_accept_reason' },
                      { name: 'Message Report Deny', value: 'message_reports_require_deny_reason' }
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
                      { name: 'Mute Request', value: 'mute_requests_enabled' },
                      { name: 'Ban Request', value: 'ban_requests_enabled' }
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
                      { name: 'Mute Request', value: 'mute_requests_webhook' },
                      { name: 'Ban Request', value: 'ban_requests_webhook' }
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
                      { name: 'Mute Request', value: 'mute_requests_immune_roles' },
                      { name: 'Ban Request', value: 'ban_requests_immune_roles' }
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
                      { name: 'Mute Request', value: 'mute_requests_immune_roles' },
                      { name: 'Ban Request', value: 'ban_requests_immune_roles' }
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
                      { name: 'Mute Request', value: 'mute_requests_ping_roles' },
                      { name: 'Ban Request', value: 'ban_requests_ping_roles' }
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
                      { name: 'Mute Request', value: 'mute_requests_ping_roles' },
                      { name: 'Ban Request', value: 'ban_requests_ping_roles' }
                    ]
                  }
                ]
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
                      { name: 'Infractions', value: 'infraction_logging_webhook' },
                      { name: 'Reports', value: 'report_logging_webhook' },
                      { name: 'Requests', value: 'request_logging_webhook' },
                      { name: 'Messages', value: 'message_logging_webhook' },
                      { name: 'Threads', value: 'thread_logging_webhook' },
                      { name: 'Voice', value: 'voice_logging_webhook' }
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
                      { name: 'Infractions', value: 'infraction_logging_enabled' },
                      { name: 'Reports', value: 'report_logging_enabled' },
                      { name: 'Requests', value: 'request_logging_enabled' },
                      { name: 'Messages', value: 'message_logging_enabled' },
                      { name: 'Threads', value: 'thread_logging_enabled' },
                      { name: 'Voice', value: 'voice_logging_enabled' }
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
                    choices: [
                      { name: 'Messages', value: 'message_logging_ignored_channels' },
                      { name: 'Threads', value: 'thread_logging_ignored_channels' },
                      { name: 'Voice', value: 'voice_logging_ignored_channels' }
                    ]
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
                    choices: [
                      { name: 'Messages', value: 'message_logging_ignored_channels' },
                      { name: 'Threads', value: 'thread_logging_ignored_channels' },
                      { name: 'Voice', value: 'voice_logging_ignored_channels' }
                    ]
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
                    choices: [
                      { name: 'Messages', value: 'message_logging_ignored_channels' },
                      { name: 'Threads', value: 'thread_logging_ignored_channels' },
                      { name: 'Voice', value: 'voice_logging_ignored_channels' }
                    ]
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
    const group = interaction.options.getSubcommandGroup() as ConfigSubcommandGroup;
    const subcommand = interaction.options.getSubcommand() as ConfigSubcommand;

    await interaction.deferReply({ ephemeral: isEphemeralReply(interaction, config) });

    switch (group) {
      case ConfigSubcommandGroup.Reports:
        {
          switch (subcommand) {
            case ConfigSubcommand.Toggle:
              return Config.Reports.toggleReport(interaction, config);
            case ConfigSubcommand.ToggleNotifications:
              return Config.Reports.toggleNotifications(interaction, config);
            case ConfigSubcommand.ForceMember:
              return Config.Reports.forceMember(interaction, config);
            case ConfigSubcommand.SetAlertChannel:
              return Config.Reports.setAlertChannel(interaction, config);
            case ConfigSubcommand.AddImmuneRole:
              return Config.Reports.addImmuneRole(interaction);
            case ConfigSubcommand.RemoveImmuneRole:
              return Config.Reports.removeImmuneRole(interaction);
            case ConfigSubcommand.AddPingRole:
              return Config.Reports.addPingRole(interaction);
            case ConfigSubcommand.RemovePingRole:
              return Config.Reports.removePingRole(interaction);
            case ConfigSubcommand.SetAutoDisregard:
              return Config.Reports.setAutoDisregard(interaction, config);
            case ConfigSubcommand.ForceReviewReason:
              return Config.Reports.forceReviewReason(interaction, config);
          }
        }

        break;

      case ConfigSubcommandGroup.Requests:
        {
          switch (subcommand) {
            case ConfigSubcommand.Toggle:
              return Config.Requests.toggleRequest(interaction, config);
            case ConfigSubcommand.SetAlertChannel:
              return Config.Requests.setAlertChannel(interaction, config);
            case ConfigSubcommand.AddImmuneRole:
              return Config.Requests.addImmuneRole(interaction);
            case ConfigSubcommand.RemoveImmuneRole:
              return Config.Requests.removeImmuneRole(interaction);
            case ConfigSubcommand.AddPingRole:
              return Config.Requests.addPingRole(interaction);
            case ConfigSubcommand.RemovePingRole:
              return Config.Requests.removePingRole(interaction);
          }
        }

        break;

      case ConfigSubcommandGroup.Logging:
        {
          switch (subcommand) {
            case ConfigSubcommand.SetLogChannel:
              return Config.Logging.setChannel(interaction, config);
            case ConfigSubcommand.SetNotificationChannel:
              return Config.Logging.setNotificationChannel(interaction, config);
            case ConfigSubcommand.Toggle:
              return Config.Logging.toggleLogging(interaction, config);
            case ConfigSubcommand.AddIgnoredChannel:
              return Config.Logging.addIgnoredChannel(interaction);
            case ConfigSubcommand.RemoveIgnoredChannel:
              return Config.Logging.removeIgnoredChannel(interaction);
            case ConfigSubcommand.ListIgnoredChannels:
              return Config.Logging.listIgnoredChannels(interaction);
          }
        }

        break;
    }

    return {
      error: 'An unknown error occurred.',
      temporary: true
    };
  }

  /**
   * Collection of subcommands for the Reports group.
   */

  public static Reports = {
    async forceMember(
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
        content: `${type === 'message_reports_require_member' ? 'Message authors' : 'Users'} must ${
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
        content: `Report authors will ${toggle ? 'now' : 'no longer'} receive status notifications for ${
          type === 'message_reports_notify_status' ? 'message reports' : 'user reports'
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
          type === 'message_reports_enabled' ? 'messages' : 'other users'
        }.`
      };
    },

    async setAlertChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      const webhooks = await interaction.guild.fetchWebhooks().catch(() => null);

      if (!webhooks) {
        return {
          error: 'Failed to fetch webhooks.',
          temporary: true
        };
      }

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
              type === 'message_reports_webhook' ? 'message reports' : 'user reports'
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
            name: `${type === 'message_reports_webhook' ? 'Message' : 'User'} Report Alerts`,
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
          type === 'message_reports_webhook' ? 'message reports' : 'user reports'
        } has been set to ${channel.toString()}.`
      };
    },

    async addImmuneRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          user_reports_immune_roles: true,
          message_reports_immune_roles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      if (role.id === interaction.guildId) {
        return {
          error: 'You cannot add the @everyone role to the immune roles list.',
          temporary: true
        };
      }

      if (config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the immune roles list for ${
            type === 'message_reports_immune_roles' ? 'message reports' : 'user reports'
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
          type === 'message_reports_immune_roles' ? 'message reports' : 'user reports'
        }.`
      };
    },

    async removeImmuneRole(interaction: ChatInputCommandInteraction<'cached'>) {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          user_reports_immune_roles: true,
          message_reports_immune_roles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      if (!config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the immune roles list for ${
            type === 'message_reports_immune_roles' ? 'message reports' : 'user reports'
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
          type === 'message_reports_immune_roles' ? 'message reports' : 'user reports'
        }.`
      };
    },

    async addPingRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          user_reports_ping_roles: true,
          message_reports_ping_roles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      if (role.id === interaction.guildId) {
        return {
          error: 'You cannot add the @everyone role to the ping roles list.',
          temporary: true
        };
      }

      if (config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the ping roles list for ${
            type === 'message_reports_ping_roles' ? 'message reports' : 'user reports'
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
          type === 'message_reports_ping_roles' ? 'message reports' : 'user reports'
        }.`
      };
    },

    async removePingRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          user_reports_ping_roles: true,
          message_reports_ping_roles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('report-type', true) as keyof typeof config;

      if (!config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the ping roles list for ${
            type === 'message_reports_ping_roles' ? 'message reports' : 'user reports'
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
          type === 'message_reports_ping_roles' ? 'message reports' : 'user reports'
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
          error: `The auto disregard duration for ${
            type === 'message_reports_disregard_after' ? 'message reports' : 'user reports'
          } is already set to **${ms(Math.floor(duration), {
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
        content: `The auto disregard duration for ${
          type === 'message_reports_disregard_after' ? 'message reports' : 'user reports'
        } has been set to **${ms(Math.floor(duration), {
          long: true
        })}**.`
      };
    },

    async forceReviewReason(
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

  /**
   * Collection of subcommands for the Requests group.
   */

  public static Requests = {
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
          type === 'mute_requests_enabled' ? 'mute requests' : 'ban requests'
        }.`
      };
    },

    async setAlertChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      const webhooks = await interaction.guild.fetchWebhooks().catch(() => null);

      if (!webhooks) {
        return {
          error: 'Failed to fetch webhooks.',
          temporary: true
        };
      }

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
              type === 'mute_requests_webhook' ? 'mute requests' : 'ban requests'
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
            name: `${type === 'mute_requests_webhook' ? 'Mute' : 'Ban'} Request Alerts`,
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
          type === 'mute_requests_webhook' ? 'mute requests' : 'ban requests'
        } has been set to ${channel.toString()}.`
      };
    },

    async addImmuneRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          mute_requests_immune_roles: true,
          ban_requests_immune_roles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      if (role.id === interaction.guildId) {
        return {
          error: 'You cannot add the @everyone role to the immune roles list.',
          temporary: true
        };
      }

      if (config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the immune roles list for ${
            type === 'mute_requests_immune_roles' ? 'mute requests' : 'ban requests'
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
          type === 'mute_requests_immune_roles' ? 'mute requests' : 'ban requests'
        }.`
      };
    },

    async removeImmuneRole(interaction: ChatInputCommandInteraction<'cached'>) {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          mute_requests_immune_roles: true,
          ban_requests_immune_roles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      if (!config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the immune roles list for ${
            type === 'mute_requests_immune_roles' ? 'mute requests' : 'ban requests'
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
          type === 'mute_requests_immune_roles' ? 'mute requests' : 'ban requests'
        }.`
      };
    },

    async addPingRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          mute_requests_ping_roles: true,
          ban_requests_ping_roles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      if (role.id === interaction.guildId) {
        return {
          error: 'You cannot add the @everyone role to the ping roles list.',
          temporary: true
        };
      }

      if (config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is already in the ping roles list for ${
            type === 'mute_requests_ping_roles' ? 'mute requests' : 'ban requests'
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
          type === 'mute_requests_ping_roles' ? 'mute requests' : 'ban requests'
        }.`
      };
    },

    async removePingRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: {
          id: interaction.guildId
        },
        select: {
          mute_requests_ping_roles: true,
          ban_requests_ping_roles: true
        }
      }))!;

      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('request-type', true) as keyof typeof config;

      if (!config[type].includes(role.id)) {
        return {
          error: `The role ${role.toString()} is not in the ping roles list for ${
            type === 'mute_requests_ping_roles' ? 'mute requests' : 'ban requests'
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
          type === 'mute_requests_ping_roles' ? 'mute requests' : 'ban requests'
        }.`
      };
    }
  };

  /**
   * Collection of subcommands for the Interactions group.
   */

  public static Logging = {
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
        content: `${capitalize(Config._parseLogType(type))} logging has been ${toggle ? 'enabled' : 'disabled'}.`
      };
    },

    async setChannel(
      interaction: ChatInputCommandInteraction<'cached'>,
      config: GuildConfig
    ): Promise<InteractionReplyData> {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      const webhooks = await interaction.guild.fetchWebhooks().catch(() => null);

      if (!webhooks) {
        return {
          error: 'Failed to fetch webhooks.',
          temporary: true
        };
      }

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
            error: `The log channel for ${Config._parseLogType(type).replaceAll(
              'voice',
              'voice related event'
            )}s is already set to ${channel.toString()}.`,
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
            name: `${capitalize(Config._parseLogType(type))} Logs`,
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
        content: `The log channel for ${Config._parseLogType(type).replaceAll(
          'voice',
          'voice related event'
        )}s has been set to ${channel.toString()}.`
      };
    },

    async setNotificationChannel(interaction: ChatInputCommandInteraction<'cached'>, config: GuildConfig) {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;

      const webhooks = await interaction.guild.fetchWebhooks().catch(() => null);

      if (!webhooks) {
        return {
          error: 'Failed to fetch webhooks.',
          temporary: true
        };
      }

      const webhook = webhooks.find(webhook => webhook.url === config.notification_webhook);

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
            name: `Notifications`,
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
          data: { notification_webhook: newWebhook.url }
        });
      }

      return {
        content: `The notification channel has been set to ${channel}.`
      };
    },

    async addIgnoredChannel(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: { id: interaction.guildId },
        select: {
          message_logging_ignored_channels: true,
          thread_logging_ignored_channels: true,
          voice_logging_ignored_channels: true
        }
      }))!;

      const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | CategoryChannel;
      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      if (config[type].includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is already in the ignored list for ${Config._parseLogType(type)} logging.`,
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
        } ${channel} has been added to the ignored list for ${Config._parseLogType(type)} logging.`
      };
    },

    async removeIgnoredChannel(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: { id: interaction.guildId },
        select: {
          message_logging_ignored_channels: true,
          thread_logging_ignored_channels: true,
          voice_logging_ignored_channels: true
        }
      }))!;

      const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | CategoryChannel;
      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      if (!config[type].includes(channel.id)) {
        return {
          error: `The ${
            isCategory(channel) ? 'category' : 'channel'
          } ${channel} is not in the ignored list for ${Config._parseLogType(type)} logging.`,
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
        } ${channel} has been removed from the ignored channels for ${Config._parseLogType(type)} logging.`
      };
    },

    async listIgnoredChannels(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
      const config = (await prisma.guild.findUnique({
        where: { id: interaction.guildId },
        select: {
          message_logging_ignored_channels: true,
          thread_logging_ignored_channels: true,
          voice_logging_ignored_channels: true
        }
      }))!;

      const type = interaction.options.getString('log-type', true) as keyof typeof config;

      if (!config[type].length) {
        return {
          content: `There are currently no ignored channels or categories for ${Config._parseLogType(type)} logging.`,
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
        content: `There are currently **${config[type].length}** ignored channels for ${Config._parseLogType(
          type
        )} logging.`,
        files: [attachment],
        components: [actionRow]
      };
    }
  };

  public static _parseLogType(key: keyof GuildConfig): string {
    switch (key) {
      case 'infraction_logging_enabled':
      case 'infraction_logging_webhook':
        return 'infraction';

      case 'message_logging_enabled':
      case 'message_logging_webhook':
      case 'message_logging_ignored_channels':
        return 'message';

      case 'thread_logging_enabled':
      case 'thread_logging_webhook':
      case 'thread_logging_ignored_channels':
        return 'thread';

      case 'voice_logging_enabled':
      case 'voice_logging_webhook':
      case 'voice_logging_ignored_channels':
        return 'voice';

      case 'report_logging_enabled':
      case 'report_logging_webhook':
        return 'report';

      case 'request_logging_enabled':
      case 'request_logging_webhook':
        return 'request';

      default:
        return 'unknown';
    }
  }
}

enum ConfigSubcommandGroup {
  Reports = 'reports',
  Requests = 'requests',
  Logging = 'logging'
}

enum ConfigSubcommand {
  Toggle = 'toggle',
  ToggleNotifications = 'toggle-notifications',
  TimeToLive = 'time-to-live',
  SetAlertChannel = 'set-alert-channel',
  AddImmuneRole = 'add-immune-role',
  AddPingRole = 'add-ping-role',
  RemoveImmuneRole = 'remove-immune-role',
  RemovePingRole = 'remove-ping-role',
  SetAutoDisregard = 'set-auto-disregard',
  ForceMember = 'force-member',
  ForceReviewReason = 'force-review-reason',
  SetLogChannel = 'set-channel',
  AddIgnoredChannel = 'add-ignored-channel',
  RemoveIgnoredChannel = 'remove-ignored-channel',
  ListIgnoredChannels = 'list-ignored-channels',
  SetNotificationChannel = 'set-notification-channel'
}

export const isCategory = (channel: GuildTextBasedChannel | CategoryChannel): boolean =>
  channel instanceof CategoryChannel;
