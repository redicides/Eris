import { GatewayIntentBits, GuildMember, Options, Partials, PermissionFlagsBits, Sweepers } from 'discord.js';

// ————————————————————————————————————————————————————————————————————————————————
// Client configuration
// ————————————————————————————————————————————————————————————————————————————————

/**
 * The gateway intent bits for the client.
 */

export const ClientIntents = [
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

export const ClientPartials = [Partials.Channel, Partials.User, Partials.GuildMember, Partials.Message];

/**
 * The cache options for the client.
 *
 * Channel messages are cached with a limit of 1000 messages, which may lead to significant memory usage.
 */

export const ClientCacheOptions = Options.cacheWithLimits({
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

export const ClientSweeperOptions = {
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

export const DefaultTimezone = 'GMT';

export const CronSlugs = {
  TaskRunner: 'TASK_RUNNER',
  ReportDisregardRunner: 'REPORT_DISREGARD_RUNNER',
  MessageInsertRunner: 'MESSAGE_INSERT_RUNNER',
  MessageDeleteRunner: 'MESSAGE_DELETE_RUNNER'
};

export const EmptyMessageContent = 'No message content available.';

export const CommonDurations = [
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

export const DurationUnits = ['second', 'minute', 'hour', 'day', 'week'];
export const MaxDurationStr = '1826 days';

export const ExitEvents = [
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

export const LogDateFormat: Intl.DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: DefaultTimezone,
  hour12: false
};

export const CommonCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

export const LockdownOverrides = [
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

export const ShortcutPermissionFlags = {
  Warn: PermissionFlagsBits.ModerateMembers,
  Mute: PermissionFlagsBits.ModerateMembers,
  Unmute: PermissionFlagsBits.ModerateMembers,
  Kick: PermissionFlagsBits.KickMembers,
  Ban: PermissionFlagsBits.BanMembers,
  Unban: PermissionFlagsBits.BanMembers
};
