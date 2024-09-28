import { InteractionReplyOptions } from 'discord.js';

export type InteractionReplyData = InteractionReplyOptions & Partial<Record<'temporary', boolean>>;
export type InteractionErrorData = Omit<InteractionReplyOptions, 'content'> &
  Partial<Record<'message', string>> &
  Partial<Record<'temporary', boolean>>;
