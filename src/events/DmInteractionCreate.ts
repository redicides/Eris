import { CommandInteraction, Events, Interaction, InteractionType } from 'discord.js';

import { InteractionErrorData, InteractionReplyData } from '@/utils/types';
import { Sentry } from '@/index';
import { getOptions, handleReply } from './InteractionCreate';

import CommandManager from '@/managers/commands/CommandManager';
import ConfigManager from '@/managers/config/ConfigManager';
import EventListener from '@/managers/events/EventListener';
import Logger from '@/utils/logger';

export default class DmInteractionCreate extends EventListener {
  constructor() {
    super(Events.DmInteractionCreate);
  }

  async execute(interaction: Interaction) {
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        return DmInteractionCreate.ApplicationCommand(interaction);
    }
  }

  private static async ApplicationCommand(interaction: CommandInteraction) {
    const command = CommandManager.getCommand(interaction.commandId, interaction.commandName);

    let content: string;

    if (!command) {
      Logger.error(`Failed to find data for command "${interaction.commandName}"`);
      content = `I am unable to find the data for command \`${interaction.commandName}\`.\nIf you believe this is a mistake, please report it to the developers.`;
      return handleReply(interaction, { content });
    }

    if (command.isGuarded) {
      if (!ConfigManager.global_config.developers.includes(interaction.user.id)) {
        content = `You cannot execute the command \`${interaction.commandName}\` as it is guarded.`;
        return handleReply(interaction, { content });
      }
    }

    try {
      await DmInteractionCreate._handleCommand(interaction);
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
      content = `An error occured while executing this command... (ID \`${sentryId}\`)`;

      return handleReply(interaction, { content });
    }
  }

  private static async _handleCommand(interaction: CommandInteraction) {
    let response: InteractionReplyData | InteractionErrorData | null;
    response = await CommandManager.handleCommand(interaction);

    // The interaction's response was handled by the command.

    if (response === null) {
      return;
    }

    const options = getOptions(response);

    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply(options);
    } else {
      await interaction.editReply(options);
    }

    if (!options.temporary) {
      return;
    }

    setTimeout(async () => {
      await interaction.deleteReply().catch(() => null);
    }, getTTL(response));
  }
}

function getTTL(options: InteractionReplyData | InteractionErrorData): number {
  return 'message' in options
    ? ConfigManager.global_config.commands.error_ttl
    : ConfigManager.global_config.commands.reply_ttl;
}
