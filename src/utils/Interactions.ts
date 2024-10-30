import { AutocompleteInteraction, Colors, CommandInteraction, Interaction, InteractionReplyOptions } from 'discord.js';

import { GuildConfig, InteractionReplyData } from './Types';
import { capitalize } from '.';
import { ComponentInteraction } from '@managers/components/Component';

import ConfigManager from '@managers/config/ConfigManager';
import CommandManager from '@managers/commands/CommandManager';
import { prisma } from '..';

const { error: error_emoji } = ConfigManager.global_config.emojis;

export class InteractionUtils {
  /**
   * Handle replying for interaction
   *
   * @param interaction The interaction to reply to
   * @param options The options to reply with
   */

  public static handleReply(
    interaction: ComponentInteraction | CommandInteraction,
    options: InteractionReplyOptions
  ): unknown {
    const { ephemeral, ...parsedOptions } = options;

    return !interaction.deferred && !interaction.replied
      ? interaction.reply(options).catch(() => {})
      : interaction.editReply({ ...parsedOptions }).catch(() => {});
  }

  /**
   * Reply with an error message to an interaction
   *
   * @param data The data for the error
   * @returns unknown
   */

  public static handleErrorReply(data: {
    interaction: ComponentInteraction | CommandInteraction;
    error: string;
  }): unknown {
    const { interaction, error } = data;

    return InteractionUtils.handleReply(interaction, {
      embeds: [{ description: `${error_emoji} ${error}`, color: Colors.NotQuiteBlack }],
      ephemeral: true
    });
  }

  /**
   * Get the TTL for the interaction reply.
   *
   * @param interaction The interaction to get the TTL for
   * @param config The guild configuration
   * @param options The reply options
   * @returns The TTL for the interaction reply
   */

  public static getInteractionTTL(
    interaction: Exclude<Interaction, AutocompleteInteraction> | CommandInteraction,
    config: GuildConfig,
    options: InteractionReplyData
  ): number {
    if (interaction.isCommand()) {
      return options.temporary ? config.commandTemporaryReplyTTL : config.commandErrorTTL;
    } else {
      return options.temporary ? config.componentTemporaryReplyTTL : config.componentErrorTTL;
    }
  }

  /**
   * Handle an autocomplete interaction
   */

  public static async handleAutocomplete(interaction: AutocompleteInteraction): Promise<unknown> {
    if (!interaction.inCachedGuild() || !interaction.inGuild()) return [];

    const option = interaction.options.getFocused(true);
    const lowercaseOption = option.value.toLowerCase();

    switch (option.name) {
      case 'command-name': {
        const application_commands = CommandManager.application_commands.filter(
          command => command.category !== 'Developer'
        );

        const commands = application_commands
          .filter(command => command.data.name.includes(lowercaseOption))
          .sort((a, b) => a.data.name.localeCompare(b.data.name));

        return interaction.respond(
          commands.map(command => ({ name: capitalize(command.data.name), value: command.data.name }))
        );
      }

      case 'node': {
        const nodes = await prisma.permission.findMany({
          where: { guildId: interaction.guildId }
        });

        const filtered_nodes = nodes
          .filter(node => {
            return node.name.includes(lowercaseOption);
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        return interaction.respond(filtered_nodes.map(node => ({ name: node.name, value: node.name })));
      }

      default:
        return [];
    }
  }
}

type AutocompleteResponse = { name: string; value: any };
