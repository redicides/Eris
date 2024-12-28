/**
 * Initialize the global eris declarations.
 * Apparently these have to be at the very top or else NodeJS won't be happy.
 */

global.eris = {
  maintenance: false,
  commandRatelimits: new Set<string>()
};

import 'dotenv/config';

import { Client } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { createPrismaRedisCache } from 'prisma-redis-middleware';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import * as SentryClient from '@sentry/node';

import { checkEnvironmentVariables, constructDatabaseUrl, sleep } from '@utils/index';

import Logger, { AnsiColor } from '@utils/Logger';
import { ClientCacheOptions, ClientIntents, ClientPartials, ClientSweeperOptions, ExitEvents } from '@utils/Constants';

import EventListenerManager from '@managers/eris/EventListenerManager';
import CommandManager from '@managers/eris/CommandManager';
import ConfigManager from '@managers/config/ConfigManager';
import ComponentManager from '@managers/eris/ComponentManager';
import DatabaseManager from '@managers/database/DatabaseManager';

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
   * 2. Message Content Intent - For enhanced message logging
   *
   * If these intents have not been granted the client will not log in
   * @see https://discord.com/developers/docs/topics/gateway#gateway-intents
   */

  intents: ClientIntents,

  /**
   * Partial types.
   */

  partials: ClientPartials,

  /**
   * Cache settings for the client.
   *
   * A message cache of 1000 or above is recommended.
   */

  makeCache: ClientCacheOptions,

  /**
   * Sweepers for the cache.
   *
   * guildMembers - Sweeps the guild member cache but excludes the client
   * messages - Sweeps the message cache
   *
   * Warning: These cache settings do lead in higher memory usage
   *          If you do not have appropriate available memory you need to adjust these number accordingly
   */

  sweepers: ClientSweeperOptions,

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

export const prisma = new PrismaClient();

async function main() {
  // Check environment variables & construct prisma database URL

  await checkEnvironmentVariables();

  process.env.DATABASE_URL = constructDatabaseUrl();

  // Cache global config

  await ConfigManager.cacheGlobalConfig();

  // Cache commands

  await CommandManager.cacheCommands();

  // Cache components

  await ComponentManager.cache();

  // Register event listeners

  await EventListenerManager.mount();

  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    profilesSampleRate: 1,
    tracesSampleRate: 1,
    integrations: [
      Sentry.consoleIntegration(),
      Sentry.prismaIntegration(),
      Sentry.nodeContextIntegration(),
      nodeProfilingIntegration()
    ]
  });

  Logger.log('SENTRY', 'Successfully initialized the Sentry client.', { color: AnsiColor.Green, full: true });

  /**
   * Initialize the prisma memory cache middleware.
   * It technically is deprecated but it works for now.
   *
   * Query results are cached for 60 seconds.
   */

  prisma.$use(
    createPrismaRedisCache({
      storage: {
        type: 'memory',
        options: {
          invalidation: true
        }
      },
      cacheTime: 60000
    })
  );

  /**
   * Connect to the database.
   * If connection fails, the bot will not start.
   */

  await prisma
    .$connect()
    .then(() => {
      Logger.log('PRISMA', 'Successfully connected to the database.', { color: AnsiColor.Green, full: true });
    })
    .catch(error => {
      Logger.error('An error occurred while connecting to the database.', error);
      process.exit(1);
    });

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
  const sentryId = Sentry.captureException(error);
  Logger.error(`[${sentryId}] Unhandled promise rejection:`, error);
});

process.on('uncaughtException', error => {
  const sentryId = Sentry.captureException(error);
  Logger.error(`[${sentryId}] Uncaught exception:`, error);
});

process.on('message', async message => {
  if (message === 'shutdown') {
    await DatabaseManager.startCleanupOperations('MESSAGE:SHUTDOWN');
    process.exit(0);
  }
});

ExitEvents.forEach(event => {
  process.on(event, async () => {
    await DatabaseManager.startCleanupOperations(event);
    process.exit(0);
  });
});
