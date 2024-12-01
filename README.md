# Charmie

A general-purpose Discord bot focused on providing strong moderation solutions while maintaining simplicity and reliability.

# Self-Hosting

If you're looking at this repository, I'll assume that you want to self-host this bot. Great, it's "easy" to do.

## Prerequisites

Before you get started, ensure you have the following:

- JavaScript Runtime ([NodeJS](https://nodejs.org/) or [Bun](https://bun.sh/))
- MongoDB Database (to store data on)
- Sentry Project (to log errors)

> [!NOTE]
> ❗ To help you with setting up the database, we've published a guide [`here`](/guides/DATABASE.md)!

## Configuration & Environment Variables

A few variables are required, and this section explians what you need to fill out. I promise this isn't rocket science.

Note: The headers below represent the names of the files you should fill these values in.

### .env

```bash
# Authentication token for logging into Discord, obtained from Discord's developer portal
BOT_TOKEN={token}

# Bot ID (client ID)
BOT_ID={id}

# The Sentry DSN for logging errors
SENTRY_DSN={sentry dsn url}

# The database URL for connecting to the database and storing data
DATABASE_URL={mongodb database url}
```

### charmie.cfg.yml

You’ll need some basic knowledge about cron here, so if you don’t have any, go ask ChatGPT. I recommend you don’t change the task_runner setting.

```yaml
bot:
  developers: ['1234', '4321'] # A list of user IDs the bot will recognize as developers
  activity: # Optional activity config for the client
    name: 'some name' # The activity message
    type: 1 # The activity type (see https://discord.com/developers/docs/events/gateway-events#activity-object-activity-types)

commands:
  error_ttl: 1234 # The default time-to-live for error embeds (in milliseconds)
  reply_ttl: 1234 # The default time-to-live for temporary responses (in milliseconds)

database:
  task_runner_cron: '* * * * *' # Cron expression for handling expired punishments
  report_disregard_cron: '* * * * *' # Cron expression for disregarding expired reports
  message_insert_cron: '0 */1 * * *' # Cron expression for inserting cached messages into the database
  message_delete_cron: '*/30 * * * *' # Cron expression from deleting old messages from the database
  message_ttl: 86400000 # How old (in milliseconds) messages in the database have to be before they are deleted
```

The values provided above are equal to:

- `'* * * * *'` - A minutely interval
- `'0 */1 * * *'` - An hourly interval
- `'*/30 * * * *'` - A 30 minute interval
- `86400000` - 1 day

## Step-By-Step Guide

All of the following steps must be performed in the **root directory** of this project, and they apply to a Linux, MacOS, and Windows environment.

### Step 1. Dependencies

This bot relies on several dependencies (libraries) to run, so you'll need to install them with the package manager of your choice.

- Node.js - `npm install`
- Bun - `bun install`

This may take a while, so grab a drink while you're at it.

### Step 2. Database Setup

Like any other server-side Node.js app, this bot relies on a database to store data, specifically MongoDB. Thankfully, ORMs like Prisma exist, making life easier for both of us.

To ensure your database matches the Prisma schema, run one of these commands depending on your runtime.

- Node.js - `npx prisma db push`
- Bun - `bunx prisma db push`

If you don’t encounter any errors, you're good to go; otherwise, you'll need to debug.

### Step 3. Compiling

This bot is written in TypeScript, because who doesn’t love types? Anyway, you'll need to compile the code into vanilla JavaScript to run it.

Again, use one of these commands depending on your runtime.

- Node.js - `npm run compile`
- Bun - `bun compile` / `bun run compile`

If the compilation fails, you’ll have to figure out why. ChatGPT may be able to help.

### Step 4. Running

Once you've completed all of the steps above, you can (finally) run the bot (provided you've filled out the correct values in .env and charmie.cfg.yml).

You get the gist; use one of these commands depending on your runtime.

- Node.js - `npm run start`
- Bun - `bun start` / `bun run start`

If you've managed to get the bot running, pat yourself on the back; if not, feel free to cry.

# Licensing

You're free to do anything you want with the bot, as long as it's not used for malicious purposes or personal gain (yes, you cannot sell free software; stop trying to make a quick buck and get a job).  
Keep in mind that you have to follow Discord's Terms of Service and Community Guidelines.

For more information on the specific license details, check out the LICENSE file; you can't miss it.
