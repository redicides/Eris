import { Events } from 'discord.js';

import { client, prisma } from '@/index';
import { CUSTOM_EVENTS } from '@/utils/Constants';

// The base class for all event listeners.
export default abstract class EventListener {
  /**
   * The client that owns this command.
   */

  public client = client;

  /**
   * Attached prisma client for ease of use
   */

  public prisma = prisma;

  /**
   * @param event The event to listen for
   * @param options The options for the event listener.
   * @param options.once Whether the event should only be listened for once.
   * @protected
   */
  protected constructor(
    public readonly event: Events | CUSTOM_EVENTS | string,
    public readonly options?: { once: boolean }
  ) {}

  /**
   * Handles the event.
   * @param args The arguments to pass to the event listener.
   */
  abstract execute(...args: unknown[]): Promise<unknown> | unknown;
}
