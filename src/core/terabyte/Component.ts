import { Awaitable, MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';
import { GuildConfig, InteractionReplyData } from '@utils/Types';
import { client, prisma } from '@/index';

export default abstract class Component {
  // The client that owns this component.

  public client = client;

  /**
   * Attached prisma client for ease of use.
   */

  public prisma = prisma;

  /**
   * @param customId The custom ID of the component.
   * @protected
   */
  protected constructor(public readonly customId: CustomID) {}

  /**
   * Handles the component interaction
   *
   * @param interaction The interaction to handle.
   * @param config The guild configuration for the guild where the interaction was created.
   */
  abstract execute(interaction: ComponentInteraction, config: GuildConfig): Awaitable<InteractionReplyData | null>;
}

export type ComponentInteraction = MessageComponentInteraction | ModalSubmitInteraction;
export type CustomID =
  | string
  | { startsWith: string }
  | { endsWith: string }
  | { includes: string }
  | {
      matches: RegExp;
    };
