import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Snowflake
} from 'discord.js';
import { InfractionAction } from '@prisma/client';

import ms from 'ms';

import { prisma } from '..';
import { DurationKeys, MessageKeys } from '@utils/Keys';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { isEphemeralReply, parseDuration, pluralize, uploadData } from '@utils/index';
import { MaxDurationStr, ShortcutPermissionFlags } from '@utils/Constants';

import Command, { CommandCategory } from '@eris/Command';
import CommandManager from '@managers/eris/CommandManager';

export default class ShortcutManager extends Command {
  constructor() {
    super({
      category: CommandCategory.Management,
      usage: [
        'create <name> <description> <action> <reason> [duration] [message-delete-time] [additional-info]',
        'delete <shortcut>',
        'edit punishment <shortcut> <new-action>',
        'edit duration <shortcut> <duration>',
        'edit reason <shortcut> <new-reason>',
        'edit additional-info <shortcut> <new-additional-info>',
        'list'
      ],
      data: {
        name: 'shortcut-manager',
        description: 'Manage the shortcut commands for this guild.',
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: ShortcutSubcommand.Create,
            description: 'Create a new shortcut command.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'name',
                description: 'The name of the shortcut command.',
                type: ApplicationCommandOptionType.String,
                required: true,
                minLength: 1,
                maxLength: 32
              },
              {
                name: 'description',
                description: 'The description of the shortcut command.',
                type: ApplicationCommandOptionType.String,
                required: true,
                minLength: 1,
                maxLength: 100
              },
              {
                name: 'action',
                description: 'The action of the shortcut command.',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                  { name: 'Warn', value: InfractionAction.Warn },
                  { name: 'Mute', value: InfractionAction.Mute },
                  { name: 'Unmute', value: InfractionAction.Unmute },
                  { name: 'Kick', value: InfractionAction.Kick },
                  { name: 'Ban', value: InfractionAction.Ban },
                  { name: 'Unban', value: InfractionAction.Unban }
                ]
              },
              {
                name: 'reason',
                description: 'The reason for the punishment action.',
                type: ApplicationCommandOptionType.String,
                required: true,
                minLength: 1,
                maxLength: 1024
              },
              {
                name: 'duration',
                description: 'The duration of the punishment action.',
                type: ApplicationCommandOptionType.String,
                required: false,
                autocomplete: true
              },
              {
                name: 'message-delete-time',
                description: 'Upon ban, delete messages sent in the past...',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: [
                  { name: 'Previous hour', value: '1h' },
                  { name: 'Previous 6 hours', value: '6h' },
                  { name: 'Previous 12 hours', value: '12h' },
                  { name: 'Previous 24 hours', value: '24h' },
                  { name: 'Previous 3 days', value: '3d' },
                  { name: 'Previous 7 days', value: '7d' }
                ]
              },
              {
                name: 'additional-info',
                description: 'Additional information for the punishment action.',
                type: ApplicationCommandOptionType.String,
                required: false,
                minLength: 1,
                maxLength: 1024
              }
            ]
          },
          {
            name: ShortcutSubcommand.Delete,
            description: 'Delete an existing shortcut command.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'shortcut',
                description: 'The name of the shortcut command to delete.',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
              }
            ]
          },
          {
            name: ShortcutSubcommand.List,
            description: 'List all the shortcut commands for this guild.',
            type: ApplicationCommandOptionType.Subcommand
          },
          {
            name: ShortcutSubcommandGroup.Edit,
            description: 'Edit an existing shortcut command.',
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
              {
                name: ShortcutSubcommand.Punishment,
                description: 'Edit the punishment action of the shortcut command.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'shortcut',
                    description: 'The name of the shortcut command to edit.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'new-action',
                    description: 'The new action of the shortcut command.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                      { name: 'Warn', value: InfractionAction.Warn },
                      { name: 'Mute', value: InfractionAction.Mute },
                      { name: 'Unmute', value: InfractionAction.Unmute },
                      { name: 'Kick', value: InfractionAction.Kick },
                      { name: 'Ban', value: InfractionAction.Ban },
                      { name: 'Unban', value: InfractionAction.Unban }
                    ]
                  }
                ]
              },
              {
                name: ShortcutSubcommand.Duration,
                description: 'Edit the duration of the shortcut command.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'shortcut',
                    description: 'The name of the shortcut command to edit.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'duration',
                    description: 'The new duration of the shortcut command.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  }
                ]
              },
              {
                name: ShortcutSubcommand.Reason,
                description: 'Edit the reason of the shortcut command.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'shortcut',
                    description: 'The name of the shortcut command to edit.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'new-reason',
                    description: 'The new reason of the shortcut command.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    minLength: 1,
                    maxLength: 1024
                  }
                ]
              },
              {
                name: ShortcutSubcommand.AdditionalInfo,
                description: 'Edit the additional information of the shortcut command.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                  {
                    name: 'shortcut',
                    description: 'The name of the shortcut command to edit.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                  },
                  {
                    name: 'new-additional-info',
                    description: 'The new additional information of the shortcut command.',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    minLength: 1,
                    maxLength: 1024
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
    const subcommand = interaction.options.getSubcommand() as ShortcutSubcommand;
    const ephemeral = interaction.channel ? isEphemeralReply(interaction, config) : true;

    await interaction.deferReply({ ephemeral });

    switch (subcommand) {
      case ShortcutSubcommand.Create:
        return ShortcutManager.createShortcutCommand(interaction);
      case ShortcutSubcommand.Delete:
        return ShortcutManager.deleteShortcutCommand(interaction);
      case ShortcutSubcommand.List:
        return ShortcutManager.listShortcutCommands(interaction.guildId);
      case ShortcutSubcommand.Punishment:
        return ShortcutManager.editPunishment(interaction);
      case ShortcutSubcommand.Duration:
        return ShortcutManager.editDuration(interaction);
      case ShortcutSubcommand.Reason:
        return ShortcutManager.editReason(interaction);
      case ShortcutSubcommand.AdditionalInfo:
        return ShortcutManager.editAdditionalInfo(interaction);

      default:
        return {
          error: 'An unknown error occurred.',
          temporary: true
        };
    }
  }

  private static async createShortcutCommand(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<InteractionReplyData> {
    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description', true);
    const action = interaction.options.getString('action', true) as InfractionAction;
    const reason = interaction.options.getString('reason', true);
    const rawDuration = interaction.options.getString('duration', false);
    const rawMsgDeleteTime = interaction.options.getString('message-delete-time', false);
    const additionalInfo = interaction.options.getString('additional-info', false);

    const shortcutCount = await prisma.shortcut.count({ where: { guild_id: interaction.guildId } });

    if (shortcutCount >= 50) {
      return {
        error: 'You cannot have more than 50 shortcut commands.',
        temporary: true
      };
    }

    if (!name.match(this._chatInputCommandNameRegex)) {
      return {
        error:
          'The provided name contains invalid characters. Please use only lowercase letters, numbers, underscores, and dashes.',
        temporary: true
      };
    }

    if (CommandManager.commands.has(name) ?? CommandManager.commands.has(name.toLowerCase())) {
      return {
        error: 'A shortcut command cannot have the same name as a built-in command.',
        temporary: true
      };
    }

    if (rawDuration && (action === 'Unmute' || action === 'Unban' || action === 'Kick')) {
      return {
        error: `You cannot specify a duration for the \`${action}\` action.`,
        temporary: true
      };
    }

    if (rawMsgDeleteTime && action !== 'Ban') {
      return {
        error: 'You can only specify a message delete time for the `Ban` action.',
        temporary: true
      };
    }

    const duration = rawDuration ? parseDuration(rawDuration) : null;
    const messageDeleteTime = rawMsgDeleteTime ? ms(rawMsgDeleteTime) : null;

    if (!duration && action === 'Mute') {
      return {
        error: 'You must specify a duration for the `Mute` action.',
        temporary: true
      };
    }

    if (Number.isNaN(duration)) {
      return {
        error: MessageKeys.Errors.InvalidDuration(false),
        temporary: true
      };
    }

    if (duration) {
      if (duration < 1000) {
        return {
          error: MessageKeys.Errors.DurationTooShort('1 second'),
          temporary: true
        };
      }

      if (duration > ms(MaxDurationStr)) {
        return {
          error: MessageKeys.Errors.DurationTooLong('5 years'),
          temporary: true
        };
      }

      if (duration > ms('28d') && action === 'Mute') {
        return {
          error: `The duration for a mute action cannot exceed 28 days.`,
          temporary: true
        };
      }
    }

    const command = await interaction.guild.commands
      .create({
        name,
        description,
        type: ApplicationCommandType.ChatInput,
        defaultMemberPermissions: ShortcutPermissionFlags[action],
        options: [
          {
            name: action === 'Ban' || action === 'Unban' ? 'user' : 'member',
            description: `The target ${action === 'Ban' || action === 'Unban' ? 'user' : 'member'}.`,
            type: ApplicationCommandOptionType.User,
            required: true
          }
        ]
      })
      .catch(() => null);

    if (!command) {
      return {
        error: 'An error occurred while creating the shortcut command. Please try again later.',
        temporary: true
      };
    }

    await prisma.shortcut.create({
      data: {
        name,
        description,
        guild_id: interaction.guildId,
        action,
        duration,
        reason,
        additional_info: additionalInfo,
        message_delete_time: messageDeleteTime
      }
    });

    return {
      content: `Successfully created shortcut command \`${name}\`.`
    };
  }

  private static async deleteShortcutCommand(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<InteractionReplyData> {
    const name = interaction.options.getString('shortcut', true);

    const shortcut = await prisma.shortcut.findUnique({
      where: { name, guild_id: interaction.guildId }
    });

    if (!shortcut) {
      return {
        error: 'The specified shortcut command does not exist.',
        temporary: true
      };
    }

    const command = await interaction.guild.commands.fetch().then(commands => commands.find(c => c.name === name));
    const commandId = command?.id;

    if (commandId) {
      const deleted = await interaction.guild.commands.delete(commandId).catch(() => null);

      if (!deleted) {
        return {
          error: 'An error occurred while deleting the shortcut command. Please try again later.',
          temporary: true
        };
      }
    }

    await prisma.shortcut.delete({ where: { name, guild_id: interaction.guildId } });

    return {
      content: `Successfully deleted shortcut command \`${name}\`.`
    };
  }

  private static async listShortcutCommands(guild_id: Snowflake): Promise<InteractionReplyData> {
    const shortcuts = await prisma.shortcut.findMany({ where: { guild_id } });

    if (!shortcuts.length) {
      return {
        content: 'There are no shortcut commands in this guild.'
      };
    }

    const map = shortcuts.map(shortcut => {
      let content = `Name: \`${shortcut.name}\`\n└ Description: ${shortcut.description}\n└ Action: ${shortcut.action}\n└ Reason: ${shortcut.reason}`;

      if (shortcut.duration) {
        content += `\n└ Duration: ${ms(Number(shortcut.duration), { long: true })}`;
      }

      if (shortcut.additional_info) {
        content += `\n└ Additional Info: ${shortcut.additional_info}`;
      }

      if (shortcut.message_delete_time) {
        content += `\n└ Message Delete Time: ${ms(Number(shortcut.message_delete_time), { long: true })}`;
      }

      return content;
    });

    const dataUrl = await uploadData(map.join('\n\n'), 'txt');
    const urlButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open In Browser').setURL(dataUrl);
    const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(urlButton);

    const buffer = Buffer.from(map.join('\n\n'), 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: 'shortcut-commands.txt' });

    return {
      content: `There ${shortcuts.length > 1 ? 'are' : 'is'} currently **${shortcuts.length}** ${pluralize(
        shortcuts.length,
        'shortcut command'
      )} in this guild.`,
      files: [attachment],
      components: [actionRow]
    };
  }

  private static async editPunishment(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<InteractionReplyData> {
    const name = interaction.options.getString('shortcut', true);
    const newAction = interaction.options.getString('new-action', true) as InfractionAction;

    const shortcut = await prisma.shortcut.findUnique({
      where: { name, guild_id: interaction.guildId }
    });

    if (!shortcut) {
      return {
        error: 'The specified shortcut command does not exist.',
        temporary: true
      };
    }

    if (newAction === shortcut.action) {
      return {
        error: 'The new action must be different from the current action.',
        temporary: true
      };
    }

    let data: any = [{ action: newAction }];
    let content = `Successfully updated the action of shortcut command \`${name}\`. It is now \`${newAction}\` instead of \`${shortcut.action}\`.`;

    if (['Kick', 'Unmute', 'Unban'].includes(newAction)) {
      data = [{ action: newAction, duration: null }];
      content += `\n\\- Note: The duration has been removed as it is no longer applicable for the new action.`;
    }

    await prisma.shortcut.update({ where: { name }, data });

    return { content };
  }

  private static async editDuration(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const name = interaction.options.getString('shortcut', true);
    const rawDuration = interaction.options.getString('new-duration', true);

    const shortcut = await prisma.shortcut.findUnique({
      where: { name, guild_id: interaction.guildId }
    });

    if (!shortcut) {
      return {
        error: 'The specified shortcut command does not exist.',
        temporary: true
      };
    }

    if (['Kick', 'Unmute', 'Unban'].includes(shortcut.action)) {
      return {
        error: 'You cannot specify a duration for the current shortcut action.',
        temporary: true
      };
    }

    if (
      (rawDuration.toLowerCase() === '0' || DurationKeys.Permanent.includes(rawDuration.toLowerCase())) &&
      shortcut.action !== 'Mute'
    ) {
      await prisma.shortcut.update({ where: { name }, data: { duration: null } });

      return {
        content: `Successfully removed the duration of shortcut command \`${name}\`.`
      };
    }

    const duration = parseDuration(rawDuration);

    if (Number.isNaN(duration)) {
      return {
        error: MessageKeys.Errors.InvalidDuration(false),
        temporary: true
      };
    }

    if (duration < 1000) {
      return {
        error: MessageKeys.Errors.DurationTooShort('1 second'),
        temporary: true
      };
    }

    if (duration > ms(MaxDurationStr) && shortcut.action !== 'Mute') {
      return {
        error: MessageKeys.Errors.DurationTooLong('5 years'),
        temporary: true
      };
    }

    if (duration > ms('28d') && shortcut.action === 'Mute') {
      return {
        error: `The duration for a mute action cannot exceed 28 days.`,
        temporary: true
      };
    }

    if (BigInt(duration) === shortcut.duration) {
      return {
        error: 'The new duration must be different from the current duration.',
        temporary: true
      };
    }

    await prisma.shortcut.update({ where: { name }, data: { duration } });

    return {
      content: `Successfully set the duration of shortcut command \`${name}\` to ${ms(duration, { long: true })}.`
    };
  }

  private static async editReason(interaction: ChatInputCommandInteraction<'cached'>): Promise<InteractionReplyData> {
    const name = interaction.options.getString('shortcut', true);
    const newReason = interaction.options.getString('new-reason', true);

    const shortcut = await prisma.shortcut.findUnique({
      where: { name, guild_id: interaction.guildId }
    });

    if (!shortcut) {
      return {
        error: 'The specified shortcut command does not exist.',
        temporary: true
      };
    }

    if (newReason === shortcut.reason) {
      return {
        error: 'The new reason must be different from the current reason.',
        temporary: true
      };
    }

    await prisma.shortcut.update({ where: { name }, data: { reason: newReason } });

    return {
      content: `Successfully updated the reason of shortcut command \`${name}\`.`
    };
  }

  private static async editAdditionalInfo(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<InteractionReplyData> {
    const name = interaction.options.getString('shortcut', true);
    const newAdditionalInfo = interaction.options.getString('new-additional-info', true);

    const shortcut = await prisma.shortcut.findUnique({
      where: { name, guild_id: interaction.guildId }
    });

    if (!shortcut) {
      return {
        error: 'The specified shortcut command does not exist.',
        temporary: true
      };
    }

    if (newAdditionalInfo === shortcut.additional_info) {
      return {
        error: 'The new additional information must be different from the current additional information.',
        temporary: true
      };
    }

    await prisma.shortcut.update({ where: { name }, data: { additional_info: newAdditionalInfo } });

    return {
      content: `Successfully updated the additional information of shortcut command \`${name}\`.`
    };
  }

  private static _chatInputCommandNameRegex = /^[\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}_-]+$/u;
}

enum ShortcutSubcommand {
  Create = 'create',
  Delete = 'delete',
  List = 'list',
  Punishment = 'punishment',
  Duration = 'duration',
  Reason = 'reason',
  AdditionalInfo = 'additional-info'
}

enum ShortcutSubcommandGroup {
  Edit = 'edit'
}
