import { Argument, ArgumentContext, ArgumentResult, AsyncArgumentResult } from '@/managers/arguments/Argument';
import { ArgumentIdentifier } from '@/managers/arguments/ArgumentIdentifier';
import { SnowflakeRegex, UserOrMemberMentionRegex } from '@sapphire/discord.js-utilities';
import { Result } from '@sapphire/result';
import { isNullish } from '@sapphire/utilities';
import { Guild, GuildMember, Snowflake } from 'discord.js';

export default class Member extends Argument<GuildMember> {
  constructor() {
    super({ name: 'member' });
  }

  async execute(parameter: string, context: MemberArgumentContext): AsyncArgumentResult<GuildMember> {
    const { guild } = context.message;

    const resolved = await resolveMember(parameter, guild!, context.performFuzzySearch ?? true);
    return resolved.mapErrInto(identifier =>
      this.error({
        parameter,
        identifier,
        message: 'That is not a valid member.',
        context: { ...context, guild }
      })
    );
  }
}

export async function resolveMember(
  parameter: string,
  guild: Guild,
  performFuzzySearch?: boolean
): Promise<Result<GuildMember, ArgumentIdentifier.Member>> {
  let member = await resolveById(parameter, guild);

  if (isNullish(member) && performFuzzySearch) {
    member = await resolveByQuery(parameter, guild);
  }

  if (member) {
    return Result.ok(member);
  }

  return Result.err(ArgumentIdentifier.Member);
}

async function resolveById(argument: string, guild: Guild): Promise<GuildMember | null> {
  const memberId = UserOrMemberMentionRegex.exec(argument) ?? SnowflakeRegex.exec(argument);
  return memberId ? guild.members.fetch(memberId[1] as Snowflake).catch(() => null) : null;
}

async function resolveByQuery(argument: string, guild: Guild): Promise<GuildMember | null> {
  argument = argument.length > 5 && argument.at(-5) === '#' ? argument.slice(0, -5) : argument;

  const members = await guild.members.fetch({ query: argument, limit: 1 }).catch(() => null);
  return members?.first() ?? null;
}

export interface MemberArgumentContext extends ArgumentContext {
  /**
   * Whether to perform a fuzzy search with the given argument.
   * This will leverage `FetchMembersOptions.query` to do the fuzzy searching.
   * @default true
   */
  readonly performFuzzySearch?: boolean;
}
