import { Collection } from 'discord.js';

import path from 'path';
import fs from 'fs';

import { Argument, IArgument } from './Argument';
import { pluralize } from '@/utils';

import Logger, { AnsiColor } from '@/utils/logger';

export default class ArgumentManager {
  public static readonly args = new Collection<string, IArgument<unknown>>();

  static async cache() {
    const dirpath = path.resolve('src/arguments');

    if (!fs.existsSync(dirpath)) {
      Logger.error(`Failed to cache arguments: directory not found.`);
      return process.exit(1);
    }

    let argumentCount = 0;

    const files = fs.readdirSync(dirpath);

    try {
      for (const file of files) {
        const argumentModule = require(`../../arguments/${file.slice(0, -3)}`);
        const argumentClass = argumentModule.default;
        const argument = new argumentClass();

        if (!(argument instanceof Argument)) {
          Logger.warn(`Skipping argument caching: ${file} is not an instance of Argument.`);
          continue;
        }

        let logMessage: string;
        let level: string;

        ArgumentManager.args.set(argument.name, argument);
        argumentCount++;

        logMessage = `Cached argument "${argument.name}"`;
        level = 'ARGUMENTS';

        Logger.log(level, logMessage, {
          color: AnsiColor.Purple
        });
      }
    } catch (error) {
      Logger.error(`Error when caching arguments:`, error);
    } finally {
      Logger.info(`Cached ${argumentCount} ${pluralize(argumentCount, 'argument')}.`);
    }
  }

  /**
   * Retrieves an argument from the cache.
   */

  static getArgument<T>(name: string): IArgument<T> | undefined {
    return ArgumentManager.args.get(name) as IArgument<T> | undefined;
  }
}
