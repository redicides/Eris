import { Result } from '@sapphire/result';

import { Argument, ArgumentContext, ArgumentResult } from '@/managers/arguments/Argument';
import { ArgumentIdentifier } from '@/managers/arguments/ArgumentIdentifier';

export default class Integer extends Argument<number> {
  private readonly messages = {
    [ArgumentIdentifier.IntegerTooSmall]: ({ minimum }: ArgumentContext) =>
      `The given number must be greater than ${minimum}.`,
    [ArgumentIdentifier.IntegerTooLarge]: ({ maximum }: ArgumentContext) =>
      `The given number must be less than ${maximum}.`,
    [ArgumentIdentifier.Integer]: () => 'That is not a valid integer.'
  } as const;

  constructor() {
    super({ name: 'integer' });
  }

  execute(parameter: string, context: ArgumentContext): ArgumentResult<number> {
    const resolved = resolveInteger(parameter);
    return resolved.mapErrInto(identifier =>
      this.error({
        parameter,
        identifier,
        message: this.messages[identifier](context),
        context
      })
    );
  }
}

function resolveInteger(
  parameter: string,
  options?: { minimum?: number; maximum?: number }
): Result<
  number,
  ArgumentIdentifier.Integer | ArgumentIdentifier.IntegerTooSmall | ArgumentIdentifier.IntegerTooLarge
> {
  const parsed = Number(parameter);

  if (!Number.isInteger(parsed)) {
    return Result.err(ArgumentIdentifier.Integer);
  }

  if (typeof options?.minimum === 'number' && parsed < options.minimum) {
    return Result.err(ArgumentIdentifier.IntegerTooSmall);
  }

  if (typeof options?.maximum === 'number' && parsed > options.maximum) {
    return Result.err(ArgumentIdentifier.IntegerTooLarge);
  }

  return Result.ok(parsed);
}
