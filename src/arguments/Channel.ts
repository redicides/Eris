import { ChannelMentionRegex, ChannelTypes } from '@sapphire/discord.js-utilities';
import { Result } from '@sapphire/result';
import { CommandInteraction, Message, Snowflake } from 'discord.js';

import { client } from '..';
import { ArgumentIdentifier } from '@/managers/arguments/ArgumentIdentifier';
import { Argument, ArgumentContext, ArgumentResult } from '@/managers/arguments/Argument';

export default class Channel extends Argument<ChannelTypes> {
  constructor() {
    super({ name: 'channel' });
  }

  execute(parameter: string, context: ArgumentContext<ChannelTypes>): ArgumentResult<ChannelTypes> {
    const resolved = resolveChannel(parameter, context.message);
    return resolved.mapErrInto(identifier =>
      this.error({
        parameter,
        identifier,
        message: 'That is not a valid channel.',
        context
      })
    );
  }
}

export function resolveChannel(
  parameter: string,
  messageOrInteraction: Message | CommandInteraction
): Result<ChannelTypes, ArgumentIdentifier.ChannelError> {
  const channelId = (ChannelMentionRegex.exec(parameter)?.[1] ?? parameter) as Snowflake;
  const channel = (messageOrInteraction.guild ? messageOrInteraction.guild.channels : client.channels).cache.get(
    channelId
  );

  if (channel) {
    return Result.ok(channel as ChannelTypes);
  }

  return Result.err(ArgumentIdentifier.ChannelError);
}
