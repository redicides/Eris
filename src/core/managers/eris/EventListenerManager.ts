import { client } from '@/index';

import path from 'path';
import fs from 'fs';

import { pluralize } from '@utils/index';

import Logger, { AnsiColor } from '@utils/Logger';
import EventListener from '@eris/EventListener';

export default class EventListenerManager {
  /**
   * Mounts all event listeners from the events directory.
   * @returns void
   */
  static async mount(): Promise<void> {
    const dirpath = path.resolve('src/events');

    if (!fs.existsSync(dirpath)) {
      Logger.info('Skipping event listener mount: events directory not found.');
      return;
    }

    let eventListenerCount = 0;

    const files = fs.readdirSync(dirpath);

    try {
      for (const file of files) {
        const listenerModule = require(`../../../events/${file.slice(0, -3)}`);
        const listenerClass = listenerModule.default;
        const listener = new listenerClass();

        if (!(listener instanceof EventListener)) {
          Logger.warn(`Skipping event listener mount: ${file} is not an instance of EventListener.`);
          continue;
        }

        const logMessage = `Mounted event listener "${listener.event}"`;

        if (listener.options?.once) {
          // Handle the event once per session
          client.once(listener.event, (...args: unknown[]) => listener.execute(...args));

          Logger.log('ONCE', logMessage, {
            color: AnsiColor.Purple
          });
        } else {
          // Handle the event every time it is emitted
          client.on(listener.event, (...args: unknown[]) => listener.execute(...args));

          Logger.log('ON', logMessage, {
            color: AnsiColor.Purple
          });
        }

        eventListenerCount++;
      }
    } catch (error) {
      Logger.error(`Error when mounting event listeners:`, error);
      return;
    } finally {
      Logger.info(`Mounted ${eventListenerCount} ${pluralize(eventListenerCount, 'event listener')}.`);
    }
  }
}
