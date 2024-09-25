import 'dotenv/config';

import { Client } from 'discord.js';
import { PrismaClient} from '@prisma/client';

import * as SentryClient from '@sentry/node';

import { CLIENT_INTENTS, CLIENT_PARTIALS, CLIENT_CACHE_OPTIONS, CLIENT_SWEEPER_OPTIONS } from '@utils/constants';
import { sleep } from './utils';

import EventListenerManager from '@managers/events/EventListenerManager';
import Logger, { AnsiColor } from '@utils/logger';
import CommandManager from '@managers/commands/CommandManager';
import ConfigManager from '@managers/config/ConfigManager';

/**
 * The main client instance.
 */

export const client = new Client({
  /**
   * Gateway intents (bits).
   *
   * The following privileged intents are required for the bot to work:
   *
   * 1. Server Members Intent - For handling guild member events
   * 2. Message Content Intent - For handling legacy commands/automoderation
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

/**
 * The Sentry client.
 */

export const Sentry = SentryClient;

/**
 * The prisma client
 */

export const prisma = new PrismaClient()

async function main() {
  if (!process.env.BOT_TOKEN) {
    throw new Error('The environment variable BOT_TOKEN is not defined.');
  }

  if (!process.env.BOT_ID) {
    throw new Error('The environment variable BOT_ID is not defined.');
  }

  if (!process.env.SENTRY_DSN) {
    throw new Error('The environment variable SENTRY_DSN is not defined.');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('The environment variable DATABASE_URL is not defined.');
  }

  // Cache global config

  await ConfigManager.cacheGlobalConfig();

  // Cache commands

  await CommandManager.cacheApplicationCommads();
  await CommandManager.cacheMessageCommands();

  // Register event listeners

  await EventListenerManager.mount();

  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    profilesSampleRate: 1,
    tracesSampleRate: 1
  });

  Logger.log('SENTRY', 'Successfully initialized the Sentry client.', { color: AnsiColor.Green, full: true });

  /**
   * Connect to the database.
   * If connection fails, the bot will not start.
   */

  await prisma.$connect().then(() => {
    Logger.log('PRISMA', 'Successfully connected to the database.', { color: AnsiColor.Green, full: true });
  }).catch(error => {
    Logger.error('An error occurred while connecting to the database.', error);
    process.exit(1);
  })

  // Login to Discord

  await client.login(process.env.BOT_TOKEN);

  // Wait 2 seconds to ensure the bot is ready

  Logger.warn('Waiting 2 seconds to ensure the client is ready before publishing commands...');
  await sleep(2000);

  // Publish commands

  await CommandManager.publish();
}

main().catch(error => {
  Logger.error(`An error occurred while starting the bot...`, error);
});

// Process events

process.on('unhandledRejection', error => {
  Logger.error('An unhandled promise rejection occurred:', error);
});

process.on('uncaughtException', error => {
  Logger.error('An uncaught exception occurred:', error);
});