import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder
} from 'discord.js';

import { elipsify, generateHelpMenuFields } from '@utils/index';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { MessageKeys } from '@utils/Keys';

import Command, { CommandCategory } from '@terabyte/Command';
import CommandManager from '@managers/terabyte/CommandManager';
import ConfigManager from '@managers/config/ConfigManager';
import ms from 'ms';

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
            name: 'command',
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
    const cmd = interaction.options.getString('command', false);

    if (cmd) {
      const command = CommandManager.getCommandByName(cmd);
      const shortcut = await CommandManager.getShortcutByName(cmd, interaction.guildId);

      if (!command) {
        if (shortcut) {
          let details = `\\- Action: \`${shortcut.action}\`\n\\- Reason: \`${elipsify(shortcut.reason, 256)}\`\n`;

          if (shortcut.additional_info) {
            details += `\\- Additional Info: \`${elipsify(shortcut.additional_info, 256)}\`\n`;
          }

          if (shortcut.duration) {
            details += `\\- Duration: \`${ms(Number(shortcut.duration), { long: true })}\`\n`;
          }

          if (shortcut.message_delete_time) {
            details += `\\- Message Delete Time: \`${ms(Number(shortcut.message_delete_time), { long: true })}\`\n`;
          }

          const embed = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({ name: this.client.user!.username, iconURL: this.client.user!.displayAvatarURL() })
            .setTitle(shortcut.name)
            .setDescription(shortcut.description)
            .setFields([
              { name: 'Usage', value: `\`/${shortcut.name} <target>\`` },
              { name: 'Details', value: details }
            ])
            .setFooter({ text: `<> = required, [] = optional` });

          return { embeds: [embed] };
        }

        return {
          error: MessageKeys.Errors.CommandNotFound,
          temporary: true
        };
      }

      if (
        command.category === CommandCategory.Developer &&
        !ConfigManager.global_config.bot.developers.includes(interaction.user.id)
      ) {
        return {
          error: MessageKeys.Errors.CommandNotFound,
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

    const shortcuts = await this.prisma.shortcut.findMany({ where: { guild_id: interaction.guildId } });

    const embed = new EmbedBuilder()
      .setColor(Colors.NotQuiteBlack)
      .setAuthor({ name: this.client.user!.username, iconURL: this.client.user!.displayAvatarURL() })
      .setTitle('Command List')
      .setFields(generateHelpMenuFields(interaction.user.id, shortcuts))
      .setTimestamp();

    return { embeds: [embed] };
  }

  private static _parseModerationUsage(command: Command, config: GuildConfig): string {
    const reasonKey = `require_${command.data.name}_reason` as keyof typeof config;
    let usage = Help._parseUsage(command);

    if (command.data.name === 'mute' && config.default_mute_duration === 0n) {
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
