import { Colors, CommandInteraction, Events, Interaction, InteractionReplyOptions, InteractionType } from 'discord.js';

import { Sentry } from '..';

import CommandManager from '@/managers/commands/CommandManager';
import EventListener from '@/managers/events/EventListener';
import Logger from '@/utils/logger';

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
      content = `I cannot execute the command \`${interaction.commandName}\` as it does not exist.`;
      description = `If you believe this is a mistake, please report it to the developers.`;
      return InteractionCreate._handleReply(interaction, {
        content,
        embeds: [{ description, color: Colors.NotQuiteBlack }]
      });
    }

    if (!interaction.inCachedGuild() && !command.allowInDms) {
      content = `You cannot execute this command in DMs.`;
      return InteractionCreate._handleReply(interaction, content);
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
      content = `An error occurred while executing this command...`;
      description = `Report it using the ID \`${sentryId}\`.`;

      return InteractionCreate._handleReply(interaction, {
        content,
        embeds: [{ description, color: Colors.NotQuiteBlack }]
      });
    }
  }

  static _handleReply(interaction: CommandInteraction, options: string | InteractionReplyOptions) {
    return !interaction.deferred && !interaction.replied
      ? interaction.reply(options).catch(() => {})
      : interaction.editReply(options).catch(() => {});
  }
}
