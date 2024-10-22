import 'dotenv/config';

import * as SentryClient from '@sentry/node';

import { sleep } from '@utils/index';
import { ExtendedClient } from '@utils/Prisma';

import Logger, { AnsiColor } from '@utils/Logger';
import CharmieClient from '@utils/Client';

import EventListenerManager from '@managers/events/EventListenerManager';
import CommandManager from '@managers/commands/CommandManager';
import ConfigManager from '@managers/config/ConfigManager';
import ComponentManager from '@managers/components/ComponentManager';

/**
 * The main client instance.
 */

export const client = new CharmieClient();

/**
 * The Sentry client.
 */

export const Sentry = SentryClient;

/**
 * The prisma client
 */

export const prisma = ExtendedClient;

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
    tracesSampleRate: 1
  });

  Logger.log('SENTRY', 'Successfully initialized the Sentry client.', { color: AnsiColor.Green, full: true });

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
  Logger.error('An unhandled promise rejection occurred:', error);
});

process.on('uncaughtException', error => {
  Logger.error('An uncaught exception occurred:', error);
});
