import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Colors,
  CommandInteraction,
  Events,
  Interaction
} from 'discord.js';
import { Shortcut } from '@prisma/client';

import { capitalize, getInteractionTTL, handleInteractionErrorReply, isEphemeralReply } from '@utils/index';
import { prisma, Sentry } from '@/index';
import { MessageKeys } from '@utils/Keys';
import { UserPermission } from '@utils/Enums';
import { EphemeralScope, GuildConfig, InteractionReplyData, PermissionNode, Result } from '@utils/Types';
import { CommonDurations, DurationUnits, LockdownOverrides } from '@utils/Constants';

import CommandManager from '@managers/terabyte/CommandManager';
import EventListener from '@terabyte/EventListener';
import ConfigManager from '@managers/config/ConfigManager';
import Logger from '@utils/Logger';
import DatabaseManager from '@managers/database/DatabaseManager';
import ComponentManager from '@managers/terabyte/ComponentManager';
import Command from '@terabyte/Command';
import Component from '@terabyte/Component';

const { emojis } = ConfigManager.global_config;
const { developers } = ConfigManager.global_config.bot;

export default class InteractionCreate extends EventListener {
  constructor() {
    super(Events.InteractionCreate);
  }

  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      return InteractionCreate.handleAutocomplete(interaction as AutocompleteInteraction);
    }

    if (!interaction.inCachedGuild()) {
      return handleInteractionErrorReply(interaction, 'Interactions are not supported in DMs.');
    }

    if (!interaction.isCommand() && interaction.customId.startsWith('&')) {
      return;
    }

    const guild = await DatabaseManager.getGuildEntry(interaction.guildId);

    let data = interaction.isCommand()
      ? CommandManager.getCommand(interaction.commandId, interaction.commandName)
      : ComponentManager.getComponent(interaction.customId);

    if (!data) {
      if (interaction.isChatInputCommand()) {
        const shortcut = await CommandManager.getShortcutByName(interaction.commandName, interaction.guildId);

        if (!shortcut) {
          return InteractionCreate._handleUnknownInteraction(interaction);
        } else {
          return InteractionCreate.handleCustomCommand(interaction, guild, shortcut);
        }
      }

      return InteractionCreate._handleUnknownInteraction(interaction);
    }

    if (data instanceof Command) {
      const result = await InteractionCreate._handleCommandChecks(
        interaction as CommandInteraction<'cached'>,
        data,
        guild
      );

      if (!result.success) {
        return handleInteractionErrorReply(interaction, result.message);
      }
    }

    try {
      await InteractionCreate.executeInteraction(interaction, data, guild);
    } catch (error) {
      const sentryId = Sentry.captureException(error, {
        user: {
          id: interaction.user.id,
          name: interaction.user.displayName,
          username: interaction.user.username
        },
        extra: {
          guild: interaction.guild.id,
          channel: interaction.channel?.id,
          commandOrComponent: interaction.isCommand() ? interaction.commandName : interaction.customId
        }
      });

      Logger.error(
        `Error executing ${
          interaction.isCommand() ? `command "${interaction.commandName}"` : `component "${interaction.customId}"`
        } (${sentryId})`,
        error
      );

      return handleInteractionErrorReply(
        interaction,
        `An error occured while executing this ${
          interaction.isCommand() ? 'command' : 'component'
        }, please include this ID when reporting the bug: \`${sentryId}\`.`
      );
    }
  }

  /**
   * Execute command and component interactions
   *
   * @param interaction The interaction
   * @param data The command or component to execute
   * @param config The guild configuration
   * @returns void
   */

  private static async executeInteraction(
    interaction: Exclude<Interaction<'cached'>, AutocompleteInteraction>,
    data: Command | Component,
    config: GuildConfig
  ): Promise<void> {
    let options: InteractionReplyData | null;

    const ephemeral = interaction.isCommand() ? isEphemeralReply(interaction, config) : true;

    if (interaction.isCommand()) {
      options = await (data as Command).execute(interaction as CommandInteraction<'cached'>, config);
    } else {
      options = await (data as Component).execute(interaction, config);
    }

    // The interaction's response was handled manually.

    if (options === null) {
      return;
    }

    const ttl = getInteractionTTL(interaction, config, options);

    const isTemporary = options.temporary;
    delete options.temporary;

    const error = options.error;
    delete options.error;

    const defaultOptions = {
      ephemeral,
      allowedMentions: { parse: [] }
    };

    const replyOptions = error
      ? {
          ...defaultOptions,
          ...options,
          embeds: [{ description: `${emojis.error} ${error}`, color: Colors.NotQuiteBlack }, ...(options.embeds ?? [])]
        }
      : { ...defaultOptions, ...options };

    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({ ...replyOptions });
    } else {
      const { ephemeral, ...rest } = replyOptions;
      await interaction.editReply({ ...rest });
    }

    if (!isTemporary) {
      return;
    }

    setTimeout(async () => {
      await interaction.deleteReply().catch(() => null);
    }, ttl);
  }

  /**
   * Execute custom moderation command interactions
   *
   * @param interaction The interaction
   * @param config The guild configuration
   * @param command The moderation command to execute
   * @returns void
   */

  private static async executeCustomCommand(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig,
    command: Shortcut
  ) {
    const ephemeral = isEphemeralReply(interaction, config);
    const options = await CommandManager.handleCustomModerationCommand(interaction, config, command, ephemeral);

    const ttl = getInteractionTTL(interaction, config, options);

    const isTemporary = options.temporary;
    delete options.temporary;

    const error = options.error;
    delete options.error;

    const defaultOptions = {
      ephemeral,
      allowedMentions: { parse: [] }
    };

    const replyOptions = error
      ? {
          ...defaultOptions,
          ...options,
          embeds: [{ description: `${emojis.error} ${error}`, color: Colors.NotQuiteBlack }, ...(options.embeds ?? [])]
        }
      : { ...defaultOptions, ...options };

    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({ ...replyOptions });
    } else {
      const { ephemeral, ...rest } = replyOptions;
      await interaction.editReply({ ...rest });
    }

    if (!isTemporary) {
      return;
    }

    setTimeout(async () => {
      await interaction.deleteReply().catch(() => null);
    }, ttl);
  }

  /**
   * Handle custom moderation command interactions (shortcuts)
   * We utilize another method to keep things cleaner and track errors better
   *
   * @param interaction The command interaction
   * @param config The guild configuration
   * @param command The shortcut
   * @returns void
   */

  private static async handleCustomCommand(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig,
    command: Shortcut
  ): Promise<unknown> {
    try {
      await InteractionCreate.executeCustomCommand(interaction, config, command);
    } catch (error) {
      const sentryId = Sentry.captureException(error, {
        user: {
          id: interaction.user.id,
          name: interaction.user.displayName,
          username: interaction.user.username
        },
        extra: {
          guild: interaction.guild.id,
          channel: interaction.channel?.id,
          commandOrComponent: interaction.commandName
        }
      });

      Logger.error(`Error executing custom moderation command "${interaction.commandName}" (${sentryId})`, error);

      return handleInteractionErrorReply(
        interaction,
        `An error occured while executing this custom moderation command, please include this ID when reporting the bug: \`${sentryId}\`.`
      );
    }
  }

  /**
   * Handle an autocomplete interaction
   */

  private static async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.inCachedGuild() || !interaction.inGuild()) return interaction.respond([]);

    const option = interaction.options.getFocused(true);

    const value = option.value;
    const lowercaseValue = option.value.toLowerCase();

    switch (option.name) {
      case 'duration': {
        if (!value) return interaction.respond(CommonDurations);

        const [numStr, unit = ''] = lowercaseValue.split(' ');
        const num = parseInt(numStr, 10);

        if (isNaN(num) || num < 1 || num > 1000) return interaction.respond([]);

        const matchingUnits = DurationUnits.filter(un => un.startsWith(unit.replace(/s$/, '')));

        return interaction.respond(
          matchingUnits.map(un => ({
            name: `${num} ${un}${num > 1 ? 's' : ''}`,
            value: `${num} ${un}${num > 1 ? 's' : ''}`
          }))
        );
      }

      case 'command': {
        const commands = CommandManager.commands.filter(command => command.category !== 'Developer');
        const shortcuts = await prisma.shortcut.findMany({ where: { guild_id: interaction.guildId } });

        const filteredCommands = commands
          .filter(
            command =>
              command.data.name.includes(value) ||
              command.data.name.includes(lowercaseValue) ||
              command.data.name.toLowerCase().includes(lowercaseValue)
          )
          .sort((a, b) => a.data.name.localeCompare(b.data.name));

        const filteredShortcuts = shortcuts
          .filter(
            shortcut =>
              shortcut.name.includes(value) ||
              shortcut.name.includes(lowercaseValue) ||
              shortcut.name.toLowerCase().includes(lowercaseValue)
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        const results = [
          ...filteredCommands.map(command => ({
            name: capitalize(command.data.name),
            value: command.data.name
          })),
          ...filteredShortcuts.map(shortcut => ({
            name: `${capitalize(shortcut.name)} (Custom)`,
            value: shortcut.name
          }))
        ].slice(0, 25); // Discord has a 25 choice limit for autocomplete

        return interaction.respond(results);
      }

      case 'shortcut': {
        const shortcuts = await prisma.shortcut.findMany({ where: { guild_id: interaction.guildId } });

        const filteredShortcuts = shortcuts
          .filter(
            shortcut =>
              shortcut.name.includes(value) ||
              shortcut.name.includes(lowercaseValue) ||
              shortcut.name.toLowerCase().includes(lowercaseValue)
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        return interaction.respond(
          filteredShortcuts.map(shortcut => ({ name: capitalize(shortcut.name), value: shortcut.name }))
        );
      }

      case 'permission-node': {
        const rawPermissions = (await DatabaseManager.getGuildEntry(interaction.guildId))
          .permission_nodes as PermissionNode[];

        const permissions = rawPermissions
          .filter(permission => {
            return permission.name.toLowerCase().includes(lowercaseValue);
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        return interaction.respond(permissions.map(permission => ({ name: permission.name, value: permission.name })));
      }

      case 'permission': {
        const permissions = Object.values(UserPermission)
          .filter(permission => {
            return permission.toLowerCase().includes(lowercaseValue) || permission.includes(value);
          })
          .sort((a, b) => a.localeCompare(b));

        return interaction.respond(
          permissions.map(permission => ({ name: capitalize(permission.replaceAll('_', ' ')), value: permission }))
        );
      }

      case 'scope': {
        const rawScopes = (await DatabaseManager.getGuildEntry(interaction.guildId))
          .ephemeral_scopes as EphemeralScope[];

        const scopes = rawScopes
          .filter(scope => {
            return scope.command_name.toLowerCase().includes(lowercaseValue);
          })
          .sort((a, b) => a.command_name.localeCompare(b.command_name));

        return interaction.respond(
          scopes.map(scope => ({ name: capitalize(scope.command_name), value: scope.command_name }))
        );
      }

      case 'override': {
        const filteredOverrides = LockdownOverrides.filter(override =>
          override.name.toLowerCase().includes(lowercaseValue)
        )
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 25);

        return interaction.respond(filteredOverrides);
      }

      default:
        return interaction.respond([]);
    }
  }

  private static _handleUnknownInteraction(interaction: Exclude<Interaction<'cached'>, AutocompleteInteraction>) {
    const sentryId = Sentry.captureException(
      new Error(
        `Failed to fetch data for ${
          interaction.isCommand() ? `command "${interaction.commandName}"` : `component "${interaction.customId}"`
        }.`
      )
    );

    return handleInteractionErrorReply(
      interaction,
      `Failed to fetch data for ${
        interaction.isCommand() ? `command "${interaction.commandName}"` : `this component`
      }, please include this ID when reporting the bug: \`${sentryId}\`.`
    );
  }

  private static async _handleCommandChecks(
    interaction: CommandInteraction<'cached'>,
    command: Command,
    config: GuildConfig
  ): Promise<Result> {
    if (command.isGuarded && !developers.includes(interaction.user.id)) {
      return {
        success: false,
        message: 'This command is not accessible to regular users.'
      };
    }

    if (config.command_disabled_list.includes(command.data.name)) {
      return {
        success: false,
        message: MessageKeys.Errors.CommandDisabled
      };
    }

    if (command.requiredPermissions) {
      if (
        !interaction.appPermissions.has(command.requiredPermissions) ||
        !interaction.channel?.permissionsFor(interaction.guild.members.me!).has(command.requiredPermissions)
      ) {
        return {
          success: false,
          message: MessageKeys.Errors.MissingPermissions(command.requiredPermissions.bitfield)
        };
      }
    }

    return { success: true };
  }
}
