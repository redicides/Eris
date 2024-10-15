import {
  AutocompleteInteraction,
  Colors,
  CommandInteraction,
  Events,
  Interaction,
  InteractionReplyOptions
} from 'discord.js';
import { Guild } from '@prisma/client';

import { Sentry } from '@/index';
import { InteractionReplyData } from '@utils/Types';

import CommandManager from '@managers/commands/CommandManager';
import EventListener from '@managers/events/EventListener';
import ConfigManager from '@managers/config/ConfigManager';
import Logger from '@utils/Logger';
import CacheManager from '@managers/database/CacheManager';
import ComponentManager from '@managers/components/ComponentManager';
import Command from '@managers/commands/Command';

export default class InteractionCreate extends EventListener {
  constructor() {
    super(Events.InteractionCreate);
  }

  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      return;
    }

    if (!interaction.inCachedGuild()) {
      return handleReply(interaction, { content: 'Interactions are only supported in guilds.', ephemeral: true });
    }

    if (!interaction.isCommand()) {
      if (interaction.customId.startsWith('?')) {
        return;
      }
    }

    let commandOrComponent = interaction.isCommand()
      ? CommandManager.getCommand(interaction.commandId, interaction.commandName)
      : ComponentManager.getComponent(interaction.customId);

    if (!commandOrComponent) {
      return InteractionCreate._handleUnknownInteraction(interaction);
    }

    if (commandOrComponent instanceof Command) {
      await InteractionCreate._handleCommandChecks(interaction as CommandInteraction<'cached'>, commandOrComponent);
    }

    const config = await CacheManager.guilds.get(interaction.guildId);

    try {
      await InteractionCreate.handleInteraction(interaction, config);
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

      return handleReply(interaction, {
        embeds: [
          {
            description: `An error occured while executing this ${
              interaction.isCommand() ? 'command' : 'component'
            }, please include this ID when reporting the bug: \`${sentryId}\`.`,
            color: Colors.NotQuiteBlack
          }
        ],
        ephemeral: true
      });
    }
  }

  private static async handleInteraction(
    interaction: Exclude<Interaction<'cached'>, AutocompleteInteraction>,
    config: Guild
  ) {
    let response: InteractionReplyData | null;

    if (interaction.isCommand()) {
      response = await CommandManager.handleCommand(interaction, config);
    } else {
      response = await ComponentManager.handleComponent(interaction);
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

    const ttl = getTTL(response, config);

    const isTemporary = options.temporary;
    delete options.temporary;

    const error = options.error;
    delete options.error;

    const replyOptions = error
      ? {
          ...defaultOptions,
          ...options,
          embeds: [{ description: error, color: Colors.NotQuiteBlack }, ...(options.embeds ?? [])]
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

    return handleReply(interaction, {
      embeds: [
        {
          description: `Failed to fetch data for ${
            interaction.isCommand() ? `command "${interaction.commandName}"` : `component "${interaction.customId}"`
          }, please include this ID when reporting the bug: \`${sentryId}\`.`,
          color: Colors.NotQuiteBlack
        }
      ],
      ephemeral: true
    });
  }

  private static async _handleCommandChecks(
    interaction: CommandInteraction<'cached'>,
    command: Command<CommandInteraction<'cached'>>
  ) {
    if (command.isGuarded) {
      if (!ConfigManager.global_config.developers.includes(interaction.user.id)) {
        return handleReply(interaction, {
          embeds: [{ description: `This command is reserved to developers..`, color: Colors.NotQuiteBlack }],
          ephemeral: true
        });
      }
    }

    if (command.requiredPermissions) {
      if (!interaction.appPermissions.has(command.requiredPermissions)) {
        return handleReply(interaction, {
          embeds: [
            {
              description: `I require the following permissions to execute this command: \`${command.requiredPermissions
                .toArray()
                .join(', ')
                .replaceAll(/[a-z][A-Z]/g, m => `${m[0]} ${m[1]}`)}\`.`,
              color: Colors.NotQuiteBlack
            }
          ],
          ephemeral: true
        });
      }
    }
  }
}

function getTTL(options: InteractionReplyData, config: Guild) {
  return 'error' in options ? config.commandErrorTTL : config.commandTemporaryReplyTTL;
}

export function handleReply(
  interaction: Exclude<Interaction, AutocompleteInteraction> | CommandInteraction,
  options: InteractionReplyOptions
) {
  const { ephemeral, ...parsedOptions } = options;

  return !interaction.deferred && !interaction.replied
    ? interaction.reply({ ephemeral, ...parsedOptions }).catch(() => {})
    : interaction.editReply({ ...parsedOptions }).catch(() => {});
}
