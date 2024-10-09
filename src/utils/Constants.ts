import { GatewayIntentBits, GuildMember, Options, Partials, Sweepers } from 'discord.js';

// ————————————————————————————————————————————————————————————————————————————————
// Client configuration
// ————————————————————————————————————————————————————————————————————————————————

/**
 * The gateway intent bits for the client.
 */

export const CLIENT_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildWebhooks
];

/**
 * The partials for the client.
 */

export const CLIENT_PARTIALS = [Partials.Channel, Partials.User, Partials.GuildMember, Partials.Message];

/**
 * The cache options for the client.
 */

export const CLIENT_CACHE_OPTIONS = Options.cacheWithLimits({
  ...Options.DefaultMakeCacheSettings,
  GuildMessageManager: 100, // Channel messages
  BaseGuildEmojiManager: 0, // Guild emojis
  StageInstanceManager: 0, // Guild stage instances
  ThreadManager: 0, // Channel threads
  AutoModerationRuleManager: 0, // Automoderation rules
  DMMessageManager: 0, // DM messages
  GuildForumThreadManager: 0,
  GuildInviteManager: 0, // Guild invites
  PresenceManager: 0, // Guild presences
  GuildScheduledEventManager: 0, // Guild scheduled events
  ThreadMemberManager: 0 // Thread members
});

/**
 * The sweeper options for the client.

 * Guild members are sweeped every 10 minutes and must be older than 30 minutes.
 * Messages sweeped every hour and must be older than 6 hours.
 *
 */

export const CLIENT_SWEEPER_OPTIONS = {
  ...Options.DefaultSweeperSettings,
  guildMembers: {
    interval: 600,
    filter: Sweepers.filterByLifetime({
      lifetime: 1800,
      excludeFromSweep: (member: GuildMember) => member.id !== process.env.BOT_ID!
    })
  },
  messages: {
    interval: 3600,
    filter: Sweepers.filterByLifetime({
      lifetime: 10800
    })
  }
};

export enum CUSTOM_EVENTS {
  DmInteraction = 'dmInteraction'
}

// ————————————————————————————————————————————————————————————————————————————————
// Miscellaneous
// ————————————————————————————————————————————————————————————————————————————————

export const DEFAULT_TIMEZONE = 'GMT';

export const CRON_SLUGS = {
  TaskRunner: 'TASK_RUNNER'
};

export const PERMANENT_DURATION_KEYS = ['permanent', 'perm', 'p', 'infinity', 'inf', 'forever', 'never'];
