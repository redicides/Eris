import { Colors, CommandInteraction, Events, Interaction, InteractionReplyOptions, InteractionType } from 'discord.js';
import { Guild } from '@prisma/client';

import { Sentry } from '@/index';
import { InteractionReplyData } from '@/utils/types';
import { GuildCache } from '@/utils/cache';
import { CUSTOM_EVENTS } from '@utils/constants';

import CommandManager from '@/managers/commands/CommandManager';
import EventListener from '@/managers/events/EventListener';
import ConfigManager from '@/managers/config/ConfigManager';
import Logger from '@/utils/logger';

export default class InteractionCreate extends EventListener {
  constructor() {
    super(Events.InteractionCreate);
  }

  async execute(interaction: Interaction) {
    if (!interaction.inCachedGuild() || !interaction.inGuild()) {
      return this.client.emit(CUSTOM_EVENTS.DmInteraction, interaction);
    }

    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        return InteractionCreate.ApplicationCommand(interaction);
    }
  }

  static async ApplicationCommand(interaction: CommandInteraction<'cached'>) {
    const command = CommandManager.getCommand(interaction.commandId, interaction.commandName);

    if (!command) {
      const sentryId = Sentry.captureException(
        new Error(`Failed to fetch data for command "${interaction.commandName}"`)
      );
      return handleReply(interaction, {
        embeds: [
          {
            description: `Failed to fetch data for command "${interaction.commandName}", please include this ID when reporting the bug: \`${sentryId}\`.`,
            color: Colors.NotQuiteBlack
          }
        ]
      });
    }

    if (command.isGuarded) {
      if (!ConfigManager.global_config.developers.includes(interaction.user.id)) {
        return handleReply(interaction, {
          embeds: [{ description: `This command is reserved to developers..`, color: Colors.NotQuiteBlack }]
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
              color: Colors.Red
            }
          ]
        });
      }
    }

    const config = await GuildCache.get(interaction.guildId);

    try {
      await InteractionCreate._handleCommand(interaction, config);
    } catch (error) {
      const sentryId = Sentry.captureException(error, {
        user: {
          id: interaction.user.id,
          name: interaction.user.displayName,
          username: interaction.user.username
        },
        extra: {
          guild: interaction.guild?.id,
          channel: interaction.channel?.id,
          command: interaction.commandName,
          commandId: interaction.commandId
        }
      });

      Logger.error(`Error executing command "${interaction.commandName}" (${sentryId})`, error);

      return handleReply(interaction, {
        embeds: [
          {
            description: `An error occured while executing this command, please include this ID when reporting the bug: \`${sentryId}\`.`,
            color: Colors.NotQuiteBlack
          }
        ]
      });
    }
  }

  private static async _handleCommand(interaction: CommandInteraction, config: Guild) {
    let response: InteractionReplyData | null;
    response = await CommandManager.handleCommand(interaction, config);

    // The interaction's response was handled manually.

    if (response === null) {
      return;
    }

    const defaultOptions = {
      ephemeral: true,
      allowedMentions: { parse: [] }
    };

    const options = response;

    const isTemporary = options.temporary;
    delete options.temporary;

    const error = options.error;
    delete options.error;

    const replyOptions = error
      ? {
          ...defaultOptions,
          ...options,
          embeds: [{ description: error, color: Colors.Red }, ...(options.embeds ?? [])]
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

    setTimeout(
      () => {
        interaction.deleteReply().catch(() => null);
      },
      getTTL(response, config)
    );
  }
}

function getTTL(options: InteractionReplyData, config: Guild) {
  return 'error' in options ? config.commandErrorTTL : config.commandTemporaryReplyTTL;
}

export function handleReply(interaction: CommandInteraction, options: Omit<InteractionReplyOptions, 'ephemeral'>) {
  return !interaction.deferred && !interaction.replied
    ? interaction.reply({ ...options, ephemeral: true }).catch(() => {})
    : interaction.editReply(options).catch(() => {});
}
