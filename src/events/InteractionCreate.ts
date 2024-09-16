import { Colors, CommandInteraction, Events, Interaction, InteractionReplyOptions, InteractionType } from 'discord.js';

import { Sentry } from '..';

import CommandManager from '@/managers/commands/CommandManager';
import EventListener from '@/managers/events/EventListener';
import Logger from '@/utils/logger';
import ConfigManager from '@/managers/config/ConfigManager';

export default class InteractionCreate extends EventListener {
  constructor() {
    super(Events.InteractionCreate);
  }

  async execute(interaction: Interaction) {
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        return InteractionCreate.handleApplicationCommand(interaction);
    }
  }

  static async handleApplicationCommand(interaction: CommandInteraction) {
    const command = CommandManager._get(interaction.commandId, interaction.commandName);
    let content: string;
    let description: string;

    if (!command) {
      Logger.error(`Command "${interaction.commandName}" does not exist.`);
      content = `I cannot execute the command \`${interaction.commandName}\` as it does not exist.\nIf you believe this is a mistake, please report it to the developers.`;
      return InteractionCreate._handleReply(interaction, content);
    }

    if (command.isGuarded) {
      if (!ConfigManager.global_config.developers.includes(interaction.user.id)) {
        content = `I don't think you should be using this command.\nBut out of curiosity, what were you trying to do?`;
        return InteractionCreate._handleReply(interaction, content);
      }
    }

    try {
      await command.execute(interaction);
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

      return InteractionCreate._handleReply(interaction, content);
    }
  }

  static _handleReply(interaction: CommandInteraction, options: string | Omit<InteractionReplyOptions, 'ephemeral'>) {
    return !interaction.deferred && !interaction.replied
      ? typeof options === 'string'
        ? interaction.reply({ content: options, ephemeral: true }).catch(() => {})
        : interaction.reply({ ...options, ephemeral: true }).catch(() => {})
      : interaction.editReply(options).catch(() => {});
  }
}
