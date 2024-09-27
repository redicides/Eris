import { Result } from '@sapphire/result';

import { Argument, ArgumentContext, ArgumentResult } from '@/managers/arguments/Argument';
import { ArgumentIdentifier } from '@/managers/arguments/ArgumentIdentifier';

export default class Boolean extends Argument<boolean> {
  constructor() {
    super({ name: 'boolean' });
  }

  async execute(parameter: string, context: ArgumentContext<boolean>): Promise<ArgumentResult<boolean>> {
    const resolved = resolveBoolean(parameter);
    return resolved.mapErrInto(identifier =>
      this.error({
        parameter,
        identifier,
        message: 'That is not a valid boolean value.',
        context
      })
    );
  }
}

const baseTruths = ['1', 'true', '+', 't', 'yes', 'y'] as const;
const baseFalses = ['0', 'false', '-', 'f', 'no', 'n'] as const;

function resolveBoolean(
  parameter: string,
  customs?: { truths?: readonly string[]; falses?: readonly string[] }
): Result<boolean, ArgumentIdentifier.BooleanError> {
  const boolean = parameter.toLowerCase();

  if ([...baseTruths, ...(customs?.truths ?? [])].includes(boolean)) {
    return Result.ok(true);
  }

  if ([...baseFalses, ...(customs?.falses ?? [])].includes(boolean)) {
    return Result.ok(false);
  }

  return Result.err(ArgumentIdentifier.BooleanError);
}
