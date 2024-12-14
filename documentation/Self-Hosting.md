# Self Hosting

So, you want to self-host Charmie? Alright then, get ready for a super streamlined process thanks to `docker` & `docker compose`.

## Prerequisites

- `docker` & `docker compose`
- Sentry Project (for error logging)

## Configuration & Environment Variables

Charmie's got a few specific environment and global configuration settings. You'll need two magical files: `.env` and `charmie.cfg.yml`. A little cron knowledge will help you out here, as we're using the [cron npm package](https://www.npmjs.com/package/cron) to automate some tasks.

First things first, grab those example files ([`config.example.yml`](/config.example.yml) and [`.env.example`](/.env.example)), and rename `config.example.yml` to `charmie.cfg.yml` and `.env.example` to `.env`.

Fill in the variables with values of your choice, except for the `POSTGRES_HOST` which should have a value of **database**. This is required as we're deploying using docker, and we're utilizing docker networks so that containers don't need to access `localhost`.

> [!CAUTION]
> ❗ Don't mess with the default values for `tasks` and `reports` runners inside the global configuration (.yml) file. A minutely interval is recommended.

## Run This Bot

> [!NOTE]
> The following steps apply to a Linux, and Mac OS environment. Sorry Windows users, but you'll have to figure this out on your own.

Now it's time to bring Charmie to life, and you need to run 2 simple commands to do that:

1. Start all services using docker compose

```bash
sudo docker compose up -d
```

2. Push the prisma schema to the database

```bash
npx prisma db push
```

3. Restart all services

```bash
sudo docker compose restart
```

If you did everything correctly, you should now have a running (and working) instance of Charmie!
If things went wrong somewhere, you can either cry or debug the issue.

## Production

For more information on how to maintain this bot for a production state, please read the [`production guide`](/documentation/Production.md).
