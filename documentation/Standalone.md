# Standalone Self-hosting

So, you want to self-host Charmie without Docker? Alright, buckle up.

## Prerequisites

> [!NOTE]
> Setting up a MongoDB database for Charmie can be about as straightforward as solving a Rubik's cube blindfolded. A database setup guide is available [`here`](/documentation/Database.md). You're welcome.

- JavaScript Runtime ([NodeJS](https://nodejs.org/) or [Bun](https://bun.sh/))
- MongoDB Database
- Sentry Project (for error logging)

## Configuration & Environment Variables

Charmie needs specific environment variables and configuration settings in two files: `.env` and `charmie.cfg.yml`. You'll want a basic understanding of cron, as Charmie uses the [cron npm package](https://www.npmjs.com/package/cron) to automate some tasks.

Check out the example files, [`config.example.yml`](/config.example.yml) and [`.env.example`](/.env.example), for the required values.  
Rename `config.example.yml` to `charmie.cfg.yml` and `.env.example` to `.env`. Fill in the values and done, easy peasy.

> [!NOTE]
> ❗ Don't mess with the default values for `tasks` and `reports` runners inside the .yml file. A minutely interval is recommended.

## Step-By-Step Guide

All steps must be performed in the **root directory** of this project, applicable to Linux, MacOS, and Windows.

### Step 1. Dependencies

Install dependencies using your preferred package manager:

- Node.js - `npm install`
- Bun - `bun install`

Grab a coffee. This might take a while.

### Step 2. Database Setup

You'll need to sync your database with the Prisma schema. Not like MongoDB is tied to a specific schema like PostgreSQL, but this will make sure your collections and indexes match accordingly.

- Node.js - `npx prisma db push`
- Bun - `bunx prisma db push`

No errors? Good. Otherwise, start debugging.

### Step 3. Compiling

TypeScript needs to be compiled to JavaScript. Use these commands:

- Node.js - `npm run compile`
- Bun - `bun compile` / `bun run compile`

Compilation fails? Time to troubleshoot.

### Step 4. Running

After completing all previous steps, run the bot:

- Node.js - `npm run start`
- Bun - `bun start` / `bun run start`

Successfully running? Congratulations. Not running? Well, good luck figuring out why.

Pro Tip: Host this thing [`containerized`](/documentation/Containerized.md), because it'll likely end up saving you a few headaches.
