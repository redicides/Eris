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
import { capitalize, parseDuration, pluralize, uploadData } from '@utils/index';
import { InteractionReplyData, GuildConfig } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';
import CommandManager from '@managers/commands/CommandManager';

export default class Config extends Command {
  constructor() {
    super({
      category: CommandCategory.Management,
      data: {
        name: 'config',
        description: 'Configure features for this server.',
        type: ApplicationCommandType.ChatInput,
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
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
      case ConfigSubcommandGroup.Reports:
        {
          switch (subcommand) {
            case ConfigSubcommand.Toggle:
              return Config.Reports.toggleReport(interaction, config);
            case ConfigSubcommand.ToggleNotifications:
              return Config.Reports.toggleNotifications(interaction, config);
            case ConfigSubcommand.RequireMember:
              return Config.Reports.requireMember(interaction, config);
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
            case ConfigSubcommand.RequireReviewReason:
              return Config.Reports.requireReviewReason(interaction, config);
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
        content: `Report authors will ${toggle ? 'now' : 'no longer'} receive status notifications for ${
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
          error: `The auto disregard duration for ${
            type === 'messageReportsDisregardAfter' ? 'message reports' : 'user reports'
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
          type === 'messageReportsDisregardAfter' ? 'message reports' : 'user reports'
        } has been set to **${ms(Math.floor(duration), {
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
            error: `The log channel for ${Config._parseLogType(type)}s is already set to ${channel.toString()}.`,
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
        content: `The log channel for ${Config._parseLogType(type)}s has been set to ${channel.toString()}.`
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
        select: { messageLoggingIgnoredChannels: true }
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
        select: { messageLoggingIgnoredChannels: true }
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

  /**
   * Collection of subcommands for the Interactions group.
   */

  public static Interactions = {
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

  public static _parseLogType(key: keyof GuildConfig): string {
    switch (key) {
      case 'infractionLoggingEnabled':
      case 'infractionLoggingWebhook':
        return 'infraction';

      case 'messageLoggingEnabled':
      case 'messageLoggingWebhook':
      case 'messageLoggingIgnoredChannels':
        return 'message';

      case 'reportLoggingEnabled':
      case 'reportLoggingWebhook':
        return 'report';

      case 'requestLoggingEnabled':
      case 'requestLoggingWebhook':
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

export const isCategory = (channel: GuildTextBasedChannel | CategoryChannel): boolean =>
  channel instanceof CategoryChannel;
