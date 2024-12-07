# Charmie

A general-purpose Discord bot focused on providing strong moderation solutions while maintaining simplicity and reliability.

# Self-Hosting

If you're looking at this repository, I'll assume that you want to self-host this bot. Great, it's "easy" to do.

## Prerequisites

> [!NOTE]
> Setting up a MongoDB database that is compatible with Charmie can be challenging! To help, a detailed guide has been published [`here`](/documentation/Database-setup.md).

- JavaScript Runtime ([NodeJS](https://nodejs.org/) or [Bun](https://bun.sh/))
- MongoDB Database (to store data on)
- Sentry Project (to log errors)

## Configuration & Environment Variables

Charmie relies on specific environment variables and global configuration settings, which should be specified in two files: `.env` and `charmie.cfg.yml`. Basic understanding of cron is essential, as Charmie utilizes the [cron npm package](https://www.npmjs.com/package/cron) to automate certain tasks.

To get started, check the example files, [`config.example.yml`](/config.example.yml) and [`.env.example`](/.env.example), for the required values.  
Remember to rename `config.example.yml` to `charmie.cfg.yml` and `.env.example` to `.env`.

> [!NOTE]
> ❗ It is recommended not to modify the default values for the `tasks` and `reports` runners, as a minutely interval is optimal.

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
