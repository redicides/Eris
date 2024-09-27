import { Awaitable, Message, PermissionsBitField } from 'discord.js';
import { client, prisma } from '@/index';
import { CommandCategory } from '@managers/commands/ApplicationCommand';

export default abstract class MessageCommand {
  /**
   * The client that owns this command.
   */

  public client = client;

  /**
   * Attached prisma client for ease of use
   */

  public prisma = prisma;

  /**
   * The name of the command.
   */

  public readonly name: string;

  /**
   * The aliases of the command.
   */

  public readonly aliases: string[];

  /**
   * The description of the command.
   */

  public readonly description: string | null;

  /**
   * The category of the command.
   */

  public readonly category: CommandCategory | null;

  /**
   * Whether the command is guarded (meaning it can only be used by the developers).
   */

  public readonly isGuarded: boolean;

  /**
   * Whether the command can be used outside of guilds.
   */

  public readonly allowInDms: boolean;

  /**
   * Usage example for the command.
   */

  public readonly usage: string | string[] | null;

  /**
   * The permissions required by the client to run the command.
   */

  public readonly requiredPermissions: PermissionsBitField | null;

  /**
   *
   * @param options
   * @protected
   */

  protected constructor(options: MessageCommandOptions) {
    this.name = options.name;
    this.aliases = options.aliases ?? [];
    this.description = options.description ?? null;
    this.category = options.category ?? null;
    this.isGuarded = options.isGuarded ?? false;
    this.allowInDms = options.allowInDms ?? false;
    this.usage = options.usage ?? null;
    this.requiredPermissions = options.requiredPermissions
      ? new PermissionsBitField(options.requiredPermissions).freeze()
      : null;
  }

  /**
   * Handles the message command. Mentions are disabled by default.
   * @param message The message to handle.
   * @param parameters The parameters of the command.
   */
  abstract execute(message: Message, parameters: string): Awaitable<unknown>;
}

interface MessageCommandOptions {
  category?: CommandCategory;
  name: string;
  aliases?: string[];
  description?: string;
  usage?: string | string[];
  requiredPermissions?: bigint | bigint[];
  isGuarded?: boolean;
  allowInDms?: boolean;
}
