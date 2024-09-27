import { Result } from '@sapphire/result';
import { isDMChannel } from '@sapphire/discord.js-utilities';
import { CommandInteraction, DMChannel, Message } from 'discord.js';

import { resolveChannel } from './Channel';
import { Argument, ArgumentContext, ArgumentResult } from '@/managers/arguments/Argument';
import { ArgumentIdentifier } from '@/managers/arguments/ArgumentIdentifier';

export default class DmChannel extends Argument<DMChannel> {
  constructor() {
    super({ name: 'dmChannel' });
  }

  execute(parameter: string, context: ArgumentContext<DMChannel>): ArgumentResult<DMChannel> {
    const resolved = resolveDMChannel(parameter, context.message);
    return resolved.mapErrInto(identifier =>
      this.error({
        parameter,
        identifier,
        message: 'That is not a valid DM channel.',
        context
      })
    );
  }
}

function resolveDMChannel(
  parameter: string,
  messageOrInteraction: Message | CommandInteraction
): Result<DMChannel, ArgumentIdentifier.ChannelError | ArgumentIdentifier.DMChannelError> {
  const result = resolveChannel(parameter, messageOrInteraction);
  return result.mapInto(value => {
    if (isDMChannel(value) && !value.partial) {
      return Result.ok(value);
    }

    return Result.err<ArgumentIdentifier.DMChannelError>(ArgumentIdentifier.DMChannelError);
  });
}
