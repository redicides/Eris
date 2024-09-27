import { IArgument } from '@/managers/arguments/Argument';

export class UserError extends Error {
  /**
   * An identifier, useful to localize emitted errors.
   */
  public readonly identifier: string;

  /**
   * User-provided context.
   */
  public readonly context: unknown;

  /**
   * Constructs an UserError.
   * @param options The UserError options
   */
  public constructor(options: UserErrorOptions) {
    super(options.message);
    this.identifier = options.identifier;
    this.context = options.context ?? null;
  }

  public override get name(): string {
    return 'UserError';
  }
}

export interface UserErrorOptions {
  /**
   * The identifier for this error.
   */
  identifier: string;

  /**
   * The message to be passed to the Error constructor.
   */
  message?: string;

  /**
   * The extra context to provide more information about this error.
   */
  context?: unknown;
}

/**
 * Errors thrown by the argument parser
 * @since 1.0.0
 * @property name This will be `'ArgumentError'` and can be used to distinguish the type of error when any error gets thrown
 */
export class ArgumentError<T = unknown> extends UserError {
  public readonly argument: IArgument<T>;
  public readonly parameter: string;

  public constructor(options: ArgumentErrorOptions<T>) {
    super({ ...options, identifier: options.identifier ?? options.argument.name });
    this.argument = options.argument;
    this.parameter = options.parameter;
  }

  public override get name(): string {
    return 'ArgumentError';
  }
}

export interface ArgumentErrorOptions<T> extends Omit<UserErrorOptions, 'identifier'> {
  /**
   * The argument that caused the error.
   * @since 1.0.0
   */
  argument: IArgument<T>;

  /**
   * The parameter that failed to be parsed.
   * @since 1.0.0
   */
  parameter: string;

  /**
   * The identifier.
   * @since 1.0.0
   * @default argument.name
   */
  identifier?: string;
}
