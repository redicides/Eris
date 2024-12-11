# Dockerized Self-Hosting

Sup Docker enthusiast. Ready to get Charmie up and running in a container because you wanna take the cool approach? Nice, let's get to it.

## Prerequisites

- MongoDB Database
- Sentry Project (for error logging)

## Configuration & Environment Variables

Charmie's got a few tricks up its sleeve with some specific environment settings. Just like with standalone hosting, you'll need two magical files: `.env` and `charmie.cfg.yml`. A little cron knowledge will help you out here, as we're using the [cron npm package](https://www.npmjs.com/package/cron) to automate some tasks.

First things first, grab those example files [`config.example.yml`](/config.example.yml) and [`.env.example`](/.env.example). Pro tip: rename them to `charmie.cfg.yml` and `.env` respectively. Fill in the values and done, easy peasy.

> [!NOTE]
> ❗ Don't mess with the default values for `tasks` and `reports` runners inside the .yml file. A minutely interval is recommended.

## Step-by-Step Guide

Just like when hosting standalone, all these steps happen in the **root directory** of the project. Works like a charm on Linux, MacOS, and Windows.

But before you try anything, Docker's got a quirk - it doesn't just waltz into your `localhost`. So you'll need to get a bit crafty with Docker networks when setting up your database using [`this guide`](/documentation/Database.md). Challenge accepted and completed? Well then, continue with the steps.

### Step 1: Docker Installation

Making sure Docker's on board is your first mission. Once installed, run these commands to verify:

- `sudo docker -v` (Check Docker version)
- `sudo docker-compose -v` (Check Docker Compose version)

### Step 2: Building the Image

Docker's got your back for dependencies and Prisma commands. Build that Charmie image with:

- `sudo docker build -t --name charmie-bot .`

### Step 3: Run This Bot

Time to bring Charmie to life. But first, you'll want to tell Docker where to find those `.env` and `charmie.cfg.yml` files, because it won't look for them like `fs` does.

Pro tip: If your files are chilling in the root directory, this command is your new best friend:

- `sudo docker run -d --name charmie --env-file .env -v $(pwd)/charmie.cfg.yml:/charmie/charmie.cfg.yml charmie-bot`

And boom! Charmie should be up and running, ready to do what it's supposed to do, if you didn't screw this up.
If you did screw this up, you'll need to debug. Looking at the container logs might help.
