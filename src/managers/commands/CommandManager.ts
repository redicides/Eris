import { Collection, CommandInteraction, Snowflake } from 'discord.js';

import path from 'path';
import fs from 'fs';

import { pluralize } from '@/utils';
import { client } from '@/index';

import ApplicationCommand from './ApplicationCommand';
import MessageCommand from './MessageCommand';

import Logger, { AnsiColor } from '@/utils/logger';

export default class CommandManager {
  public static readonly application_commands = new Collection<string, ApplicationCommand<CommandInteraction>>();
  public static readonly message_commands = new Collection<string, MessageCommand>();

  static async cacheApplicationCommads() {
    const dirpath = path.resolve('src/commands/application');

    if (!fs.existsSync(dirpath)) {
      Logger.info(`Skipping application command caching: commands directory not found.`);
      return;
    }

    let commandCount = 0;

    const files = fs.readdirSync(dirpath);

    try {
      for (const file of files) {
        const commandModule = require(`../../commands/application/${file.slice(0, -3)}`);
        const commandClass = commandModule.default;
        const command = new commandClass();

        if (!(command instanceof ApplicationCommand)) {
          Logger.warn(`Skipping command caching: ${file} is not an instance of Command.`);
          continue;
        }

        let logMessage: string;
        let level: string;

        CommandManager.application_commands.set(command.data.name, command);

        logMessage = `Cached global command "${command.data.name}"`;
        level = 'APPLICATION';

        Logger.log(level, logMessage, {
          color: AnsiColor.Purple
        });

        commandCount++;
      }
    } catch (error) {
      Logger.error(`Error when caching commands:`, error);
    } finally {
      Logger.info(`Cached ${commandCount} ${pluralize(commandCount, 'command')}.`);
    }
  }

  static async cacheMessageCommands() {
    const dirpath = path.resolve('src/commands/message');

    if (!fs.existsSync(dirpath)) {
      Logger.info(`Skipping message command caching: commands directory not found.`);
      return;
    }

    let commandCount = 0;

    const files = fs.readdirSync(dirpath);

    try {
      for (const file of files) {
        const commandModule = require(`../../commands/message/${file.slice(0, -3)}`);
        const commandClass = commandModule.default;
        const command = new commandClass();

        if (!(command instanceof MessageCommand)) {
          Logger.warn(`Skipping message command caching: ${file} is not an instance of Command.`);
          continue;
        }

        let logMessage: string;
        let level: string;

        CommandManager.message_commands.set(command.name, command);

        logMessage = `Cached message command "${command.name}"`;
        level = 'CLIENT';

        Logger.log(level, logMessage, {
          color: AnsiColor.Orange
        });

        commandCount++;
      }
    } catch (error) {
      Logger.error(`Error when caching message commands:`, error);
    } finally {
      Logger.info(`Cached ${commandCount} ${pluralize(commandCount, 'message command')}.`);
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

  static getApplicationCommand(
    commandId: Snowflake,
    commandName: string
  ): ApplicationCommand<CommandInteraction> | null {
    const isGlobalCommand = client.application?.commands.cache.has(commandId);

    if (isGlobalCommand) {
      return CommandManager.application_commands.get(commandName) ?? null;
    }

    return null;
  }

  static getMessageCommand(commandName: string): MessageCommand | null {
    return CommandManager.message_commands.get(commandName) ?? null;
  }
}
