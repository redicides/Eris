import {
  ChatInputCommandInteraction,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  ChannelType,
  TextChannel
} from 'discord.js';

import Command, { CommandCategory } from '@/managers/commands/Command';
import { InteractionReplyData } from '@/utils/Types';
import CacheManager from '@/managers/database/CacheManager';
import { client, prisma } from '..';
import { parseDuration } from '@/utils';
import ms from 'ms';

export default class Config extends Command<ChatInputCommandInteraction<'cached'>> {
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
                description: 'Toggle a command.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'command',
                    description: 'The command to toggle.',
                    type: ApplicationCommandOptionType.String,
                    required: true
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
                    required: true
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
                name: ConfigSubcommand.SetAutoDisregard,
                description: 'Set the auto disregard duration for a specific report type.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'duration',
                    description: 'The duration to set for the auto disregard.',
                    type: ApplicationCommandOptionType.String,
                    required: true
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
              }
            ]
          }
        ]
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const group = interaction.options.getSubcommandGroup() as ConfigSubcommandGroup;
    const subcommand = interaction.options.getSubcommand();

    switch (group) {
      case ConfigSubcommandGroup.Commands: {
        switch (subcommand) {
          case ConfigSubcommand.Toggle:
            return Config.toggleCommand(interaction);
          case ConfigSubcommand.TimeToLive:
            return Config.setTimeToLive(interaction);
        }
      }

      case ConfigSubcommandGroup.Reports:
        switch (subcommand) {
          case ConfigSubcommand.Toggle:
            return Config.toggleReport(interaction);
          case ConfigSubcommand.SetAlertChannel:
            return Config.setAlertChannel(interaction);
          case ConfigSubcommand.AddImmuneRole:
            return Config.addImmuneRole(interaction);
          case ConfigSubcommand.RemoveImmuneRole:
            return Config.removeImmuneRole(interaction);
          case ConfigSubcommand.SetAutoDisregard:
            return Config.setAutoDisregard(interaction);
        }
    }

    return {
      error: 'An unknown error occurred.',
      temporary: true
    };
  }

  private static async toggleCommand(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<InteractionReplyData> {
    const command = interaction.options.getString('command', true);
    let { commandDisabledList } = await CacheManager.guilds.get(interaction.guildId);

    let toggle = true;

    if (commandDisabledList.includes(command)) {
      commandDisabledList = commandDisabledList.filter(c => c !== command);
      toggle = false;
    } else {
      commandDisabledList.push(command);
    }

    await prisma.guild.update({
      where: { id: interaction.guildId },
      data: { commandDisabledList }
    });

    return {
      content: `Command \`${command}\` has been ${toggle ? 'enabled' : 'disabled'}.`
    };
  }

  private static async setTimeToLive(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<InteractionReplyData> {
    const config = await CacheManager.guilds.get(interaction.guildId);
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

  private static async toggleReport(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const config = await CacheManager.guilds.get(interaction.guildId);
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
  }

  private static async setAlertChannel(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<InteractionReplyData> {
    const config = await CacheManager.guilds.get(interaction.guildId);
    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const type = interaction.options.getString('report-type', true) as keyof typeof config;

    const webhooks = await interaction.guild.fetchWebhooks();
    const webhook = webhooks.find(webhook => webhook.url === config[type]);

    if (!webhooks.size) {
      return {
        error: 'Failed to fetch the webhooks for this guild.',
        temporary: true
      };
    }

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
  }

  private static async addImmuneRole(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<InteractionReplyData> {
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
  }

  private static async removeImmuneRole(interaction: ChatInputCommandInteraction<'cached'>) {
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
  }

  private static async setAutoDisregard(interaction: ChatInputCommandInteraction<'cached'>) {
    const config = await CacheManager.guilds.get(interaction.guildId);
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
  }
}

enum ConfigSubcommandGroup {
  Commands = 'commands',
  Reports = 'reports'
}

enum ConfigSubcommand {
  Toggle = 'toggle',
  TimeToLive = 'time-to-live',
  SetAlertChannel = 'set-alert-channel',
  AddImmuneRole = 'add-immune-role',
  RemoveImmuneRole = 'remove-immune-role',
  SetAutoDisregard = 'set-auto-disregard'
}
