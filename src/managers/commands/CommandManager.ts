import { Collection, Snowflake } from 'discord.js';

import path from 'path';
import fs from 'fs';

import { pluralize } from '@utils/index';
import { client } from '@/index';

import Command from './Command';
import Logger, { AnsiColor } from '@utils/Logger';

export default class CommandManager {
  /**
   * The cached application commands.
   */
  public static readonly application_commands = new Collection<string, Command>();

  /**
   * Caches all commands from the commands directory.
   * @returns void
   */
  static async cacheCommands() {
    const dirpath = path.resolve('src/commands');

    if (!fs.existsSync(dirpath)) {
      Logger.info(`Skipping application command caching: commands directory not found.`);
      return;
    }

    let commandCount = 0;

    const files = fs.readdirSync(dirpath);

    try {
      for (const file of files) {
        const commandModule = require(`../../commands/${file.slice(0, -3)}`);
        const commandClass = commandModule.default;
        const command = new commandClass();

        if (!(command instanceof Command)) {
          Logger.warn(`Skipping command caching: ${file} is not an instance of Command.`);
          continue;
        }

        let logMessage: string;
        let level: string;

        CommandManager.application_commands.set(command.data.name, command);

        logMessage = `Cached command "${command.data.name}"`;
        level = 'GLOBAL';

        Logger.log(level, logMessage, {
          color: AnsiColor.Purple
        });

        commandCount++;
      }
    } catch (error) {
      Logger.error(`Error when caching commands:`, error);
    } finally {
      Logger.info(`Cached ${commandCount} ${pluralize(commandCount, 'application command')}.`);
    }
  }

  static async publish() {
    Logger.info('Publishing commands...');

    const logMessage = (commandCount: number): string =>
      `Published ${commandCount} ${pluralize(commandCount, 'command')}.`;

    const globalCommands = CommandManager.application_commands.map(command => command.data);

    if (!globalCommands.length) {
      Logger.warn('No global commands to publish.');
      return;
    }

    const publishedCommands = await client.application?.commands.set(globalCommands).catch(() => null);

    if (!publishedCommands) {
      throw new Error('Failed to publish global commands.');
    }

    Logger.log('GLOBAL', logMessage(publishedCommands.size), {
      color: AnsiColor.Purple
    });
  }

  static getCommand(commandId: Snowflake, commandName: string): Command | null {
    const isGlobalCommand = client.application?.commands.cache.has(commandId);

    if (isGlobalCommand) {
      return CommandManager.application_commands.get(commandName) ?? null;
    }

    return null;
  }
}
