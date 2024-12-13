import { InteractionReplyOptions, Snowflake } from 'discord.js';
import { Prisma } from '@prisma/client';

export type InteractionReplyData = InteractionReplyOptions &
  Partial<Record<'temporary', boolean>> &
  Partial<Record<'error', string>>;

export type Result<T = undefined> =
  | { success: false; message: string }
  | ({ success: true } & (T extends undefined ? { data?: never } : { data: T }));

export type GuildConfig = Prisma.GuildGetPayload<{}>;

export type MessageLog = {
  guild_id: Snowflake;
  message_id: Snowflake;
  author_id: Snowflake;
  channel_id: Snowflake;
  sticker_id: Snowflake | null;
  created_at: Date;
  content: string | null;
  attachments?: string[];
};

export type ObjectDiff = Record<string | number | symbol, ObjectPropDiff>;

interface ObjectPropDiff {
  old: unknown;
  new: unknown;
}
