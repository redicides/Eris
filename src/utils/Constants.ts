import {
  GatewayIntentBits,
  GuildMember,
  Options,
  Partials,
  PermissionFlagsBits,
  PermissionsBitField,
  Sweepers
} from 'discord.js';

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
  GatewayIntentBits.GuildWebhooks,
  GatewayIntentBits.GuildVoiceStates
];

/**
 * The partials for the client.
 */

export const CLIENT_PARTIALS = [Partials.Channel, Partials.User, Partials.GuildMember, Partials.Message];

/**
 * The cache options for the client.
 *
 * Channel messages are cached with a limit of 1000 messages, which may lead to significant memory usage.
 */

export const CLIENT_CACHE_OPTIONS = Options.cacheWithLimits({
  ...Options.DefaultMakeCacheSettings,
  GuildMessageManager: 1000, // Channel messages
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

 * Guild members are sweeped every 30 minutes and must be older than 1 hour.
 * Messages sweeped every hour and must be older than 3 hours.
 *
 * The bot is excluded from the guild members sweeper.
 * The bot is not excluded from the messages sweeper.
 */

export const CLIENT_SWEEPER_OPTIONS = {
  ...Options.DefaultSweeperSettings,
  guildMembers: {
    interval: 1800,
    filter: Sweepers.filterByLifetime({
      lifetime: 3600,
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

// ————————————————————————————————————————————————————————————————————————————————
// Miscellaneous
// ————————————————————————————————————————————————————————————————————————————————

export const DEFAULT_TIMEZONE = 'GMT';

export const CRON_SLUGS = {
  TaskRunner: 'TASK_RUNNER',
  ReportDisregardRunner: 'REPORT_DISREGARD_RUNNER',
  MessageInsertRunner: 'MESSAGE_INSERT_RUNNER',
  MessageDeleteRunner: 'MESSAGE_DELETE_RUNNER'
};

export const EMPTY_MESSAGE_CONTENT = 'Unknown message content.';

export const COMMON_DURATIONS = [
  { name: '1 minute', value: '1 minute' },
  { name: '5 minutes', value: '5 minutes' },
  { name: '15 minutes', value: '15 minutes' },
  { name: '30 minutes', value: '30 minutes' },
  { name: '45 minutes', value: '45 minutes' },
  { name: '1 hour', value: '1 hour' },
  { name: '2 hours', value: '2 hours' },
  { name: '3 hours', value: '3 hours' },
  { name: '6 hours', value: '6 hours' },
  { name: '12 hours', value: '12 hours' },
  { name: '1 day', value: '1 day' },
  { name: '2 days', value: '2 days' },
  { name: '3 days', value: '3 days' },
  { name: '1 week', value: '7 days' },
  { name: '2 weeks', value: '14 days' },
  { name: '1 month', value: '30 days' }
];

export const DURATION_UNITS = ['second', 'minute', 'hour', 'day', 'week'];
export const MAX_DURATION_STR = '1826 days';

export const EXIT_EVENTS = [
  'SIGHUP',
  'SIGINT',
  'SIGQUIT',
  'SIGILL',
  'SIGTRAP',
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGUSR1',
  'SIGSEGV',
  'SIGUSR2',
  'SIGTERM'
];

export const LOG_ENTRY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: DEFAULT_TIMEZONE,
  hour12: false
};

export const COMMON_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

export const LOCKDOWN_OVERRIDES = [
  { name: 'Add Reactions', value: 'AddReactions' },
  { name: 'Attach Files', value: 'AttachFiles' },
  { name: 'Connect', value: 'Connect' },
  { name: 'Create Invite', value: 'CreateInstantInvite' },
  { name: 'Create Private Threads', value: 'CreatePrivateThreads' },
  { name: 'Create Public Threads', value: 'CreatePublicThreads' },
  { name: 'Embed Links', value: 'EmbedLinks' },
  { name: 'Priority Speaker', value: 'PrioritySpeaker' },
  { name: 'Read Message History', value: 'ReadMessageHistory' },
  { name: 'Request to Speak', value: 'RequestToSpeak' },
  { name: 'Send Messages', value: 'SendMessages' },
  { name: 'Send Messages in Threads', value: 'SendMessagesInThreads' },
  { name: 'Send TTS Messages', value: 'SendTTSMessages' },
  { name: 'Send Voice Messages', value: 'SendVoiceMessages' },
  { name: 'Speak', value: 'Speak' },
  { name: 'Stream', value: 'Stream' },
  { name: 'Use Application Commands', value: 'UseApplicationCommands' },
  { name: 'Use Activities', value: 'UseEmbeddedActivities' },
  { name: 'Use External Emojis', value: 'UseExternalEmojis' },
  { name: 'Use External Sounds', value: 'UseExternalSounds' },
  { name: 'Use External Stickers', value: 'UseExternalStickers' },
  { name: 'Use Soundboard', value: 'UseSoundboard' },
  { name: 'Use Voice-Activity-Detection (VAD)', value: 'UseVAD' },
  { name: 'View Channel', value: 'ViewChannel' }
];

export const SHORTCUT_PERMISSIONS = {
  Mute: new PermissionsBitField(PermissionFlagsBits.ModerateMembers),
  Unmute: new PermissionsBitField(PermissionFlagsBits.ModerateMembers),
  Kick: new PermissionsBitField(PermissionFlagsBits.KickMembers),
  Ban: new PermissionsBitField(PermissionFlagsBits.BanMembers),
  Unban: new PermissionsBitField(PermissionFlagsBits.BanMembers)
};

export const SHORTCUT_PERMISSION_FLAGS = {
  Warn: PermissionFlagsBits.ModerateMembers,
  Mute: PermissionFlagsBits.ModerateMembers,
  Unmute: PermissionFlagsBits.ModerateMembers,
  Kick: PermissionFlagsBits.KickMembers,
  Ban: PermissionFlagsBits.BanMembers,
  Unban: PermissionFlagsBits.BanMembers
};
