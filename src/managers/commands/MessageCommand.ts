import { Awaitable, Message, PermissionsBitField } from 'discord.js';
import { ArgumentStream, IUnorderedStrategy, Lexer, Parser } from '@sapphire/lexure';

import { client, prisma } from '@/index';
import { CommandCategory } from '@managers/commands/ApplicationCommand';
import { FlagStrategyOptions, FlagUnorderedStrategy } from '@utils/strategies';
import { Args } from '../arguments/Args';

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
   * The lexer to be used for command parsing
   */
  protected lexer: Lexer;

  /**
   * The strategy to use for the lexer.
   */
  public strategy: IUnorderedStrategy;

  /**
   *
   * @param options
   * @param options.name The name of the command.
   * @param options.aliases The aliases of the command.
   * @param options.description The description of the command.
   * @param options.category The category of the command.
   * @param options.isGuarded Whether the command is guarded (meaning it can only be used by the developers).
   * @param options.allowInDms Whether the command can be used outside of guilds.
   * @param options.usage Usage example for the command.
   * @param options.requiredPermissions The permissions required by the client to run the command.
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
    this.strategy = new FlagUnorderedStrategy(options);
    this.lexer = new Lexer({
      quotes: options.quotes ?? [
        ['"', '"'], // Double quotes
        ['“', '”'], // Fancy quotes (on iOS)
        ['「', '」'], // Corner brackets (CJK)
        ['«', '»'] // French quotes (guillemets)
      ]
    });
  }

  /**
   * Handles the message command. Mentions are disabled by default.
   * @param message The message to handle.
   * @param args The arguments for the command.
   */
  abstract execute(message: Message, args: Args): Awaitable<unknown>;

  /**
   * The message parse method. This method returns the arguments for the command.
   * @param message The message that triggered the command.
   * @param parameters The raw parameters as a single string.
   * @param context The command-context used in this execution.
   */
  public parse(message: Message, parameters: string, context: MessageCommandRunContext): Awaitable<Args> {
    const parser = new Parser(this.strategy);
    const args = new ArgumentStream(parser.run(this.lexer.run(parameters)));
    return new Args(message, this, args, context);
  }
}

interface MessageCommandOptions extends FlagStrategyOptions {
  category?: CommandCategory;
  name: string;
  aliases?: string[];
  description?: string;
  usage?: string | string[];
  requiredPermissions?: bigint | bigint[];
  isGuarded?: boolean;
  allowInDms?: boolean;
  quotes?: [string, string][];
}

export interface MessageCommandRunContext extends Record<PropertyKey, unknown> {
  /**
   * The prefix used to run this command.
   *
   * This is a string for the mention and default prefix, and a RegExp for the `regexPrefix`.
   */
  prefix: string | RegExp;
  /**
   * The alias used to run this command.
   */
  commandName: string;
  /**
   * The matched prefix.
   */
  commandPrefix: string;
}

export namespace MessageCommand {
  export type Options = MessageCommandOptions;
  export type RunContext = MessageCommandRunContext;
}
