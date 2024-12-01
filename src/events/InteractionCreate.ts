import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Colors,
  CommandInteraction,
  Events,
  Interaction
} from 'discord.js';
import { ModerationCommand } from '@prisma/client';

import { capitalize, getInteractionTTL, handleInteractionErrorReply, isEphemeral } from '@utils/index';
import { prisma, Sentry } from '@/index';
import { MessageKeys } from '@utils/Keys';
import { GuildConfig, InteractionReplyData, Result } from '@utils/Types';
import { CHANNEL_PERMISSION_OVERRIDES, COMMON_DURATIONS, DURATION_UNITS } from '@utils/Constants';

import CommandManager from '@managers/commands/CommandManager';
import EventListener from '@managers/events/EventListener';
import ConfigManager from '@managers/config/ConfigManager';
import Logger from '@utils/Logger';
import DatabaseManager from '@managers/database/DatabaseManager';
import ComponentManager from '@managers/components/ComponentManager';
import Command from '@managers/commands/Command';
import Component from '@managers/components/Component';

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
      return handleInteractionErrorReply({ interaction, error: 'Interactions are not supported in DMs.' });
    }

    if (!interaction.isCommand() && interaction.customId.startsWith('?')) {
      return;
    }

    const guild = await DatabaseManager.getGuildEntry(interaction.guildId);

    let data = interaction.isCommand()
      ? CommandManager.getCommand(interaction.commandId, interaction.commandName)
      : ComponentManager.getComponent(interaction.customId);

    if (!data) {
      if (interaction.isChatInputCommand()) {
        const command = await prisma.moderationCommand.findUnique({
          where: { name: interaction.commandName, guildId: interaction.guildId }
        });

        if (!command) {
          return InteractionCreate._handleUnknownInteraction(interaction);
        } else {
          return InteractionCreate.handleCustomCommandInteraction(interaction, guild, command);
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
        return handleInteractionErrorReply({ interaction, error: result.message });
      }
    }

    try {
      await InteractionCreate.handleInteraction(interaction, data, guild);
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

      return handleInteractionErrorReply({
        interaction,
        error: `An error occured while executing this ${
          interaction.isCommand() ? 'command' : 'component'
        }, please include this ID when reporting the bug: \`${sentryId}\`.`
      });
    }
  }

  /**
   * Handle command and component interactions
   *
   * @param interaction The interaction to handle
   * @param data The command or component to execute
   * @param config The guild configuration
   * @returns void
   */

  private static async handleInteraction(
    interaction: Exclude<Interaction<'cached'>, AutocompleteInteraction>,
    data: Command | Component,
    config: GuildConfig
  ): Promise<void> {
    let response: InteractionReplyData | null;

    const ephemeral = interaction.isCommand() ? isEphemeral({ interaction, config }) : true;

    if (interaction.isCommand()) {
      response = await (data as Command).execute(interaction as CommandInteraction<'cached'>, config, ephemeral);
    } else {
      response = await (data as Component).execute(interaction, config);
    }

    // The interaction's response was handled manually.

    if (response === null) {
      return;
    }

    const options = response;

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
   * Handle custom moderation command interactions
   *
   * @param interaction The interaction to handle
   * @param config The guild configuration
   * @param command The moderation command to execute
   * @returns void
   */

  private static async handleCustomCommandInteraction(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig,
    command: ModerationCommand
  ) {
    const ephemeral = isEphemeral({ interaction, config });
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
   * Handle an autocomplete interaction
   */

  private static async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.inCachedGuild() || !interaction.inGuild()) return interaction.respond([]);

    const option = interaction.options.getFocused(true);

    const value = option.value;
    const lowercaseValue = option.value.toLowerCase();

    switch (option.name) {
      case 'duration': {
        if (!value) return interaction.respond(COMMON_DURATIONS);

        const [numStr, unit = ''] = lowercaseValue.split(' ');
        const num = parseInt(numStr, 10);

        if (isNaN(num) || num < 1 || num > 1000) return interaction.respond([]);

        const matchingUnits = DURATION_UNITS.filter(un => un.startsWith(unit.replace(/s$/, '')));

        return interaction.respond(
          matchingUnits.map(un => ({
            name: `${num} ${un}${num > 1 ? 's' : ''}`,
            value: `${num} ${un}${num > 1 ? 's' : ''}`
          }))
        );
      }

      case 'command': {
        const commands = CommandManager.commands.filter(command => command.category !== 'Developer');
        const shortcuts = await prisma.moderationCommand.findMany({ where: { guildId: interaction.guildId } });

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
        const shortcuts = await prisma.moderationCommand.findMany({ where: { guildId: interaction.guildId } });

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
        const rawPermissions = (await DatabaseManager.getGuildEntry(interaction.guildId)).permissions;

        const permissions = rawPermissions
          .filter(permission => {
            return permission.name.toLowerCase().includes(lowercaseValue);
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        return interaction.respond(permissions.map(permission => ({ name: permission.name, value: permission.name })));
      }

      case 'scope': {
        const rawScopes = (await DatabaseManager.getGuildEntry(interaction.guildId)).ephemeralScopes;

        const scopes = rawScopes
          .filter(scope => {
            return scope.commandName.toLowerCase().includes(lowercaseValue);
          })
          .sort((a, b) => a.commandName.localeCompare(b.commandName));

        return interaction.respond(
          scopes.map(scope => ({ name: capitalize(scope.commandName), value: scope.commandName }))
        );
      }

      case 'override': {
        const filteredOverrides = CHANNEL_PERMISSION_OVERRIDES.filter(override =>
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

    return handleInteractionErrorReply({
      interaction,
      error: `Failed to fetch data for ${
        interaction.isCommand() ? `command "${interaction.commandName}"` : `this component`
      }, please include this ID when reporting the bug: \`${sentryId}\`.`
    });
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

    if (config.commandDisabledList.includes(command.data.name)) {
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
