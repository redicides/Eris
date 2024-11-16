import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GatewayIntentBits,
  GuildMember,
  Options,
  Partials,
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

export const PERMANENT_DURATION_KEYS = ['permanent', 'perm', 'p', 'infinity', 'inf', 'forever', 'never'];

export const EMPTY_MESSAGE_CONTENT = 'Unknown message content.';

export const YES_BUTTON = new ButtonBuilder().setCustomId('?yes').setLabel('Yes').setStyle(ButtonStyle.Success);
export const NO_BUTTON = new ButtonBuilder().setCustomId('?no').setLabel('No').setStyle(ButtonStyle.Danger);

export const YES_NO_ROW = new ActionRowBuilder<ButtonBuilder>().setComponents(YES_BUTTON, NO_BUTTON);

export const COMMON_DURATIONS = [
  { name: '1 minute', value: '1 minute' },
  { name: '15 minutes', value: '15 minutes' },
  { name: '30 minutes', value: '30 minutes' },
  { name: '1 hour', value: '1 hour' },
  { name: '6 hours', value: '6 hours' },
  { name: '1 day', value: '1 day' },
  { name: '1 week', value: '7 days' }
];

export const DURATION_UNITS = ['second', 'minute', 'hour', 'day', 'week'];

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

export const CHANNEL_PERMISSION_OVERRIDES = [
  { name: 'Add Reactions', value: 'AddReactions' },
  { name: 'Attach Files', value: 'AttachFiles' },
  { name: 'Connect', value: 'Connect' },
  { name: 'Create Invite', value: 'CreateInstantInvite' },
  { name: 'Create Private Threads', value: 'CreatePrivateThreads' },
  { name: 'Create Public Threads', value: 'CreatePublicThreads' },
  { name: 'Embed Links', value: 'EmbedLinks' },
  { name: 'Manage Channel', value: 'ManageChannels' },
  { name: 'Manage Messages', value: 'ManageMessages' },
  { name: 'Manage Threads', value: 'ManageThreads' },
  { name: 'Manage Webhooks', value: 'ManageWebhooks' },
  { name: 'Mention Everyone', value: 'MentionEveryone' },
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
