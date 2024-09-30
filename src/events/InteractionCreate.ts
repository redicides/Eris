import { Colors, CommandInteraction, Events, Interaction, InteractionReplyOptions, InteractionType } from 'discord.js';
import { Guild } from '@prisma/client';

import { Sentry } from '@/index';
import { InteractionErrorData, InteractionReplyData } from '@/utils/types';
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
    const config = await GuildCache.get(interaction.guildId);

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
      content = `An error occured while executing this command... (ID \`${sentryId}\`)`;

      return handleReply(interaction, { content });
    }
  }

  private static async _handleCommand(interaction: CommandInteraction, config: Guild) {
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

    setTimeout(
      async () => {
        await interaction.deleteReply().catch(() => null);
      },
      getTTL(response, config)
    );
  }
}

function getTTL(options: InteractionReplyData | InteractionErrorData, config: Guild) {
  return 'message' in options ? config.commandErrorTTL : config.commandTemporaryReplyTTL;
}

export function handleReply(interaction: CommandInteraction, options: Omit<InteractionReplyOptions, 'ephemeral'>) {
  return !interaction.deferred && !interaction.replied
    ? interaction.reply({ ...options, ephemeral: true }).catch(() => {})
    : interaction.editReply(options).catch(() => {});
}

export function getOptions(
  response: InteractionReplyData | InteractionErrorData
): InteractionReplyOptions & { temporary?: boolean } {
  const baseOptions = {
    ephemeral: true,
    allowedMentions: { parse: [] }
  };

  if ('message' in response) {
    return {
      ...baseOptions,
      ...response,
      embeds: [
        {
          description: response.message,
          color: Colors.Red
        },
        ...(response.embeds || [])
      ]
    };
  }

  const { temporary, ...rest } = response;
  return { ...baseOptions, ...rest, temporary };
}
