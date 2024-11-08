import { InteractionReplyOptions, Snowflake } from 'discord.js';
import { Guild, Prisma } from '@prisma/client';

export type InteractionReplyData = InteractionReplyOptions &
  Partial<Record<'temporary', boolean>> &
  Partial<Record<'error', string>>;

export type Result<T = undefined> =
  | { success: false; message: string }
  | ({ success: true } & (T extends undefined ? { data?: never } : { data: T }));

export type GuildConfig = Prisma.GuildGetPayload<{}>;

export type MessageLog = {
  guildId: Snowflake;
  messageId: Snowflake;
  authorId: Snowflake;
  channelId: Snowflake;
  stickerId: Snowflake | null;
  createdAt: Date;
  content: string | null;
  attachments?: string[];
};
