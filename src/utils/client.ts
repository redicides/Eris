import { Client } from 'discord.js';
import { CLIENT_CACHE_OPTIONS, CLIENT_INTENTS, CLIENT_PARTIALS, CLIENT_SWEEPER_OPTIONS } from '@utils/constants';

export default class CharmieClient extends Client {
  constructor() {
    super({
      /**
       * Gateway intents (bits).
       *
       * The following privileged intents are required for the bot to work:
       *
       * 1. Server Members Intent - For handling guild member events
       * 2. Message Content Intent - For handling legacy commands/auto-moderation
       *
       * If these intents have not been granted the client will not log in
       * @see https://discord.com/developers/docs/topics/gateway#gateway-intents
       */

      intents: CLIENT_INTENTS,

      /**
       * Partial types.
       */

      partials: CLIENT_PARTIALS,

      /**
       * Cache settings for the client.
       *
       * A message cache of 100 or above is required for proper storing of messages
       * Message database storing is essential and used for many utility related functions
       */

      makeCache: CLIENT_CACHE_OPTIONS,

      /**
       * Sweepers for the cache.
       *
       * guildMembers - Sweeps the guild member cache but excludes the client
       *
       * Warning: These cache settings do lead in higher memory usage
       *          If you do not have appropriate available memory please lower these numbers
       */

      sweepers: CLIENT_SWEEPER_OPTIONS,

      allowedMentions: {
        parse: []
      }
    });
  }
}
