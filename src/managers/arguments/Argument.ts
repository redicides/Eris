import { Awaitable, Message } from 'discord.js';
import { Result } from '@sapphire/result';

import { Args } from './Args';
import { client } from '@/index';
import { ArgumentError, ArgumentErrorOptions } from '@utils/errors';

import MessageCommand, { MessageCommandRunContext } from '../commands/MessageCommand';

export type ArgumentResult<T> = Result<T, ArgumentError<T>>;
export type AwaitableArgumentResult<T> = Awaitable<ArgumentResult<T>>;
export type AsyncArgumentResult<T> = Promise<ArgumentResult<T>>;

export interface IArgument<T> {
  /**
   * The name of the argument, this is used to make the identification of an argument easier.
   */
  readonly name: string;

  /**
   * The method which is called when invoking the argument.
   * @param parameter The string parameter to parse.
   * @param context The context for the method call, contains the message, command, and other options.
   */
  execute(parameter: string, context: ArgumentContext<T>): AwaitableArgumentResult<T>;
}

export abstract class Argument<T = unknown> implements IArgument<T> {
  /**
   * The name of the argument, this is used to make the identification of an argument easier.
   */

  public readonly name: string;

  /**
   * The client that owns this argument.
   */

  public client = client;

  protected constructor(options: ArgumentOptions) {
    this.name = options.name;
  }

  public abstract execute(parameter: string, context: ArgumentContext<T>): AwaitableArgumentResult<T>;

  public ok(value: T): ArgumentResult<T> {
    return Args.ok(value);
  }

  public error(options: Omit<ArgumentErrorOptions<T>, 'argument'>): ArgumentResult<T> {
    return Args.error({ argument: this, identifier: this.name, ...options });
  }
}

export interface ArgumentOptions {
  /**
   * The name for the argument.
   */
  readonly name: string;
}

export interface ArgumentContext<T = unknown> extends Record<PropertyKey, unknown> {
  argument: IArgument<T>;
  args: Args;
  message: Message;
  command: MessageCommand;
  commandContext: MessageCommandRunContext;
  minimum?: number;
  maximum?: number;
  inclusive?: boolean;
}

export namespace Argument {
  export type Options = ArgumentOptions;
  export type Context<T = unknown> = ArgumentContext<T>;
  export type Result<T> = ArgumentResult<T>;
  export type AwaitableResult<T> = AwaitableArgumentResult<T>;
  export type AsyncResult<T> = AsyncArgumentResult<T>;
}
