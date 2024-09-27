import { DMChannel, GuildMember, Message, Role, User } from 'discord.js';
import { ArgumentStream, join, Parameter } from '@sapphire/lexure';
import { Option, Result } from '@sapphire/result';
import { ChannelTypes } from '@sapphire/discord.js-utilities';

import { UserError, ArgumentError, ArgumentErrorOptions } from '@utils/errors';
import { Argument, IArgument } from './Argument';
import { ArgumentIdentifier } from './ArgumentIdentifier';

import ArgumentManager from './ArgumentManager';
import MessageCommand, { MessageCommandRunContext } from '../commands/MessageCommand';

export class Args {
  /**
   * The original message that triggered the command.
   */
  public readonly message: Message;

  /**
   * The command that is being run.
   */
  public readonly command: MessageCommand;

  /**
   * The context of the command being run.
   */
  public readonly commandContext: MessageCommandRunContext;

  /**
   * The internal Lexure parser.
   */
  protected readonly parser: ArgumentStream;

  /**
   * The states stored in the args.
   */

  private readonly states: ArgumentStream.State[] = [];

  public constructor(
    message: Message,
    command: MessageCommand,
    parser: ArgumentStream,
    context: MessageCommandRunContext
  ) {
    this.message = message;
    this.command = command;
    this.parser = parser;
    this.commandContext = context;
  }

  /**
   * Sets the parser to the first token.
   */
  public start(): Args {
    this.parser.reset();
    return this;
  }

  public async pickResult<T>(type: IArgument<T>, options?: ArgOptions): Promise<ResultType<T>>;
  public async pickResult<K extends keyof ArgType>(type: K, options?: ArgOptions): Promise<ResultType<ArgType[K]>>;
  public async pickResult<K extends keyof ArgType>(type: K, options: ArgOptions = {}): Promise<ResultType<ArgType[K]>> {
    const argument = this.resolveArgument<ArgType[K]>(type);
    if (!argument) return this.unavailableArgument(type);

    const result = await this.parser.singleParseAsync(async arg =>
      argument.execute(arg, {
        args: this,
        argument,
        message: this.message,
        command: this.command,
        commandContext: this.commandContext,
        ...options
      })
    );
    if (result.isErrAnd(value => value === null)) {
      return this.missingArguments(argument.name);
    }

    return result as ResultType<ArgType[K]>;
  }

  public async pick<T>(type: IArgument<T>, options?: ArgOptions): Promise<T>;
  public async pick<K extends keyof ArgType>(type: K, options?: ArgOptions): Promise<ArgType[K]>;
  public async pick<K extends keyof ArgType>(type: K, options?: ArgOptions): Promise<ArgType[K]> {
    const result = await this.pickResult(type, options);
    return result.unwrapRaw();
  }

  public async restResult<T>(type: IArgument<T>, options?: ArgOptions): Promise<ResultType<T>>;
  public async restResult<K extends keyof ArgType>(type: K, options?: ArgOptions): Promise<ResultType<ArgType[K]>>;
  public async restResult<T>(type: keyof ArgType | IArgument<T>, options: ArgOptions = {}): Promise<ResultType<T>> {
    const argument = this.resolveArgument(type);
    if (!argument) return this.unavailableArgument(type);
    if (this.parser.finished) return this.missingArguments(argument.name);

    const state = this.parser.save();
    const data = join(this.parser.many().unwrapOr<Parameter[]>([]));
    const result = await argument.execute(data, {
      args: this,
      argument,
      message: this.message,
      command: this.command,
      commandContext: this.commandContext,
      ...options
    });

    return result.inspectErr(() => this.parser.restore(state));
  }

  public async rest<T>(type: IArgument<T>, options?: ArgOptions): Promise<T>;
  public async rest<K extends keyof ArgType>(type: K, options?: ArgOptions): Promise<ArgType[K]>;
  public async rest<K extends keyof ArgType>(type: K, options?: ArgOptions): Promise<ArgType[K]> {
    const result = await this.restResult(type, options);
    return result.unwrapRaw();
  }

  public async repeatResult<T>(type: IArgument<T>, options?: RepeatArgOptions): Promise<ArrayResultType<T>>;
  public async repeatResult<K extends keyof ArgType>(
    type: K,
    options?: RepeatArgOptions
  ): Promise<ArrayResultType<ArgType[K]>>;
  public async repeatResult<K extends keyof ArgType>(
    type: K,
    options: RepeatArgOptions = {}
  ): Promise<ArrayResultType<ArgType[K]>> {
    const argument = this.resolveArgument(type);
    if (!argument) return this.unavailableArgument(type);
    if (this.parser.finished) return this.missingArguments(argument.name);

    const output: ArgType[K][] = [];

    for (let i = 0, times = options.times ?? Infinity; i < times; i++) {
      const result = await this.parser.singleParseAsync(async arg =>
        argument.execute(arg, {
          args: this,
          argument,
          message: this.message,
          command: this.command,
          commandContext: this.commandContext,
          ...options
        })
      );

      if (result.isErr()) {
        const error = result.unwrapErr();
        if (error === null) break;

        if (output.length === 0) {
          return result as Result.Err<UserError | ArgumentError<ArgType[K]>>;
        }

        break;
      }

      output.push(result.unwrap() as ArgType[K]);
    }

    return Result.ok(output);
  }

  public async repeat<T>(type: IArgument<T>, options?: RepeatArgOptions): Promise<T[]>;
  public async repeat<K extends keyof ArgType>(type: K, options?: RepeatArgOptions): Promise<ArgType[K][]>;
  public async repeat<K extends keyof ArgType>(type: K, options?: RepeatArgOptions): Promise<ArgType[K][]> {
    const result = await this.repeatResult(type, options);
    return result.unwrapRaw();
  }

  public getFlags(...keys: readonly string[]): boolean {
    return this.parser.flag(...keys);
  }

  public getOptionResult(...keys: readonly string[]): Option<string> {
    return this.parser.option(...keys);
  }

  public getOption(...keys: readonly string[]): string | null {
    return this.parser.option(...keys).unwrapOr(null);
  }

  public getOptionsResult(...keys: readonly string[]): Option<readonly string[]> {
    return this.parser.options(...keys);
  }

  public getOptions(...keys: readonly string[]): readonly string[] | null {
    return this.parser.options(...keys).unwrapOr(null);
  }

  public save(): void {
    this.states.push(this.parser.save());
  }

  public restore(): void {
    if (this.states.length !== 0) this.parser.restore(this.states.pop()!);
  }

  public get finished(): boolean {
    return this.parser.finished;
  }

  /**
   * Defines the `JSON.stringify` override.
   */
  public toJSON(): ArgsJson {
    return { message: this.message, command: this.command, commandContext: this.commandContext };
  }

  protected unavailableArgument<T>(type: string | IArgument<T>): Result.Err<UserError> {
    const name = typeof type === 'string' ? type : type.name;
    return Result.err(
      new UserError({
        identifier: ArgumentIdentifier.Unavailable,
        message: `Unable to process command. Argument "${name}" was not found.`,
        context: { name, ...this.toJSON() }
      })
    );
  }

  protected missingArguments(name: string): Result.Err<UserError> {
    return Result.err(
      new UserError({
        identifier: ArgumentIdentifier.Missing,
        message: `You must provide a ${name} argument.`,
        context: this.toJSON()
      })
    );
  }

  /**
   * Resolves an argument.
   * @param arg The argument name or {@link IArgument} instance.
   */
  private resolveArgument<T>(arg: keyof ArgType | IArgument<T>): IArgument<T> | undefined {
    if (typeof arg === 'object') return arg;
    return ArgumentManager.getArgument(arg as string) as IArgument<T> | undefined;
  }

  public static make<T>(cb: IArgument<T>['execute'], name = ''): IArgument<T> {
    return { execute: cb, name };
  }

  public static ok<T>(value: T): Result.Ok<T> {
    return Result.ok(value);
  }

  public static error<T>(options: ArgumentErrorOptions<T>): Result.Err<ArgumentError<T>> {
    return Result.err(new ArgumentError<T>(options));
  }
}

export interface ArgsJson {
  message: Message<boolean>;
  command: MessageCommand;
  commandContext: MessageCommandRunContext;
}

export interface ArgType {
  boolean: boolean;
  channel: ChannelTypes;
  dmChannel: DMChannel;
  integer: number;
  member: GuildMember;
  message: Message;
  number: number;
  role: Role;
  string: string;
  url: URL;
  user: User;
}

export interface ArgOptions extends Omit<Argument.Context, 'message' | 'command'> {}

export interface RepeatArgOptions extends ArgOptions {
  /**
   * The maximum amount of times the argument can be repeated.
   * @default Infinity
   */
  times?: number;
}

/**
 * The callback used for {@link Args.next}.
 */
export interface ArgsNextCallback<T> {
  /**
   * The value to be mapped.
   */
  (value: string): Option<T>;
}

export type ResultType<T> = Result<T, UserError | ArgumentError<T>>;
export type ArrayResultType<T> = Result<T[], UserError | ArgumentError<T>>;
