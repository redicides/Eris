import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder
} from 'discord.js';

import { capitalize, generateHelpMenuFields } from '@utils/index';
import { GuildConfig, InteractionReplyData } from '@utils/Types';

import Command, { CommandCategory } from '@managers/commands/Command';
import CommandManager from '@managers/commands/CommandManager';
import ConfigManager from '@managers/config/ConfigManager';

export default class Help extends Command {
  constructor() {
    super({
      category: CommandCategory.Utility,
      usage: '[command]',
      data: {
        name: 'help',
        description: 'Get detailed information about a command or a list of all commands.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'command-name',
            description: 'The command to get detailed information about.',
            type: ApplicationCommandOptionType.String,
            required: false,
            autocomplete: true
          }
        ]
      }
    });
  }

  async execute(
    interaction: ChatInputCommandInteraction<'cached'>,
    config: GuildConfig
  ): Promise<InteractionReplyData> {
    const commandName = interaction.options.getString('command-name', false);

    if (commandName) {
      const command = CommandManager.application_commands.get(commandName.toLowerCase());

      if (
        !command ||
        (command.category === 'Developer' && !ConfigManager.global_config.developers.includes(interaction.user.id))
      ) {
        return {
          error: 'The provided command does not exist.',
          temporary: true
        };
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setAuthor({ name: this.client.user!.username, iconURL: this.client.user!.displayAvatarURL() })
        .setTitle(command.data.name);

      if (command.data.type === ApplicationCommandType.ChatInput) {
        embed.setDescription(command.data.description);
        embed.setFooter({ text: `<> = required, [] = optional` });
      } else {
        embed.setDescription(`No description available for context menu commands.`);
      }

      if (command.usage) {
        if (Help._moderationCommands.includes(command.data.name)) {
          embed.addFields({
            name: 'Usage',
            value: Help._parseModerationUsage(command, config)
          });
        } else {
          embed.addFields({
            name: 'Usage',
            value: Help._parseUsage(command)
          });
        }
      }

      return { embeds: [embed] };
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.NotQuiteBlack)
      .setAuthor({ name: this.client.user!.username, iconURL: this.client.user!.displayAvatarURL() })
      .setTitle('Command List')
      .setFields(generateHelpMenuFields(interaction.user.id))
      .setTimestamp();

    return { embeds: [embed] };
  }

  private static _parseModerationUsage(command: Command, config: GuildConfig): string {
    const reasonKey = `require${capitalize(command.data.name)}Reason` as keyof typeof config;
    let usage = Help._parseUsage(command);

    if (command.data.name === 'mute' && config.defaultMuteDuration === 0n) {
      usage = usage.replaceAll('[duration]', '<duration>');
    }

    return config[reasonKey] === true ? usage.replaceAll('[reason]', '<reason>') : usage;
  }

  private static _parseUsage(command: Command): string {
    if (typeof command.usage === 'string') {
      return `\`/${command.data.name} ${command.usage}\``;
    }

    return command.usage!.map(u => `\`/${command.data.name} ${u}\``).join('\n');
  }

  private static _moderationCommands = ['warn', 'mute', 'kick', 'ban', 'unmute', 'unban'];
}
