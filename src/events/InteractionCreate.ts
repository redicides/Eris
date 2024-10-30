import { AutocompleteInteraction, Colors, CommandInteraction, Events, Interaction } from 'discord.js';

import { Sentry } from '@/index';
import { InteractionReplyData, GuildConfig, Result } from '@utils/Types';
import { InteractionUtils } from '@utils/Interactions';

import CommandManager from '@managers/commands/CommandManager';
import EventListener from '@managers/events/EventListener';
import ConfigManager from '@managers/config/ConfigManager';
import Logger from '@utils/Logger';
import CacheManager from '@managers/database/CacheManager';
import ComponentManager from '@managers/components/ComponentManager';
import Command from '@managers/commands/Command';

const { emojis, developers } = ConfigManager.global_config;

export default class InteractionCreate extends EventListener {
  constructor() {
    super(Events.InteractionCreate);
  }

  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      return InteractionUtils.handleAutocomplete(interaction);
    }

    if (!interaction.inCachedGuild()) {
      return InteractionUtils.handleErrorReply({ interaction, error: 'Interactions are not supported in DMs.' });
    }

    if (!interaction.isCommand() && interaction.customId.startsWith('?')) {
      return;
    }

    const guild = await CacheManager.guilds.get(interaction.guildId);

    let data = interaction.isCommand()
      ? CommandManager.getCommand(interaction.commandId, interaction.commandName)
      : ComponentManager.getComponent(interaction.customId);

    if (!data) {
      return InteractionCreate._handleUnknownInteraction(interaction);
    }

    if (data instanceof Command) {
      const result = await InteractionCreate._handleCommandChecks(
        interaction as CommandInteraction<'cached'>,
        data,
        guild
      );

      if (!result.success) {
        return InteractionUtils.handleErrorReply({ interaction, error: result.message });
      }
    }

    try {
      await InteractionCreate.handleInteraction(interaction, guild);
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

      return InteractionUtils.handleErrorReply({
        interaction,
        error: `An error occured while executing this ${
          interaction.isCommand() ? 'command' : 'component'
        }, please include this ID when reporting the bug: \`${sentryId}\`.`
      });
    }
  }

  private static async handleInteraction(
    interaction: Exclude<Interaction<'cached'>, AutocompleteInteraction>,
    config: GuildConfig
  ) {
    let response: InteractionReplyData | null;

    if (interaction.isCommand()) {
      response = await CommandManager.handleCommand(interaction, config);
    } else {
      response = await ComponentManager.handleComponent(interaction, config);
    }

    // The interaction's response was handled manually.

    if (response === null) {
      return;
    }

    const defaultOptions = {
      ephemeral: true,
      allowedMentions: { parse: [] }
    };

    const options = response;

    const ttl = InteractionUtils.getInteractionTTL(interaction, config, options);

    const isTemporary = options.temporary;
    delete options.temporary;

    const error = options.error;
    delete options.error;

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

  private static _handleUnknownInteraction(interaction: Exclude<Interaction, AutocompleteInteraction>) {
    const sentryId = Sentry.captureException(
      new Error(
        `Failed to fetch data for ${
          interaction.isCommand() ? `command "${interaction.commandName}"` : `component "${interaction.customId}"`
        }.`
      )
    );

    return InteractionUtils.handleErrorReply({
      interaction,
      error: `Failed to fetch data for ${
        interaction.isCommand() ? `command "${interaction.commandName}"` : `component "${interaction.customId}"`
      }, please include this ID when reporting the bug: \`${sentryId}\`.`
    });
  }

  private static async _handleCommandChecks(
    interaction: CommandInteraction<'cached'>,
    command: Command<CommandInteraction<'cached'>>,
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
        message: 'This command is disabled in this guild.'
      };
    }

    if (command.requiredPermissions) {
      if (!interaction.appPermissions.has(command.requiredPermissions)) {
        return {
          success: false,
          message: `I require the following permissions to execute this command: \`${command.requiredPermissions
            .toArray()
            .join(', ')
            .replaceAll(/[a-z][A-Z]/g, m => `${m[0]} ${m[1]}`)}\`.`
        };
      }
    }

    return { success: true };
  }
}
