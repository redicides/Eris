# Self Hosting

Thinking of self-hosting this? Great! The process will be a breeze if you’re gonna use `docker` and `docker compose`. If not, then you're on your own.

## Prerequisites

- `docker` & `docker compose`
- Sentry Project (for error logging)

## Configuration & Environment Variables

Eris has a few specific environment and global configuration settings. You'll need two magical files: `.env` and `eris.cfg.yml`. A little cron knowledge will help you out here, as we're using the [cron npm package](https://www.npmjs.com/package/cron) to automate some tasks.

First things first, grab those example files ([`config.example.yml`](/config.example.yml) and [`.env.example`](/.env.example)), and rename `config.example.yml` to `eris.cfg.yml` and `.env.example` to `.env`.

Fill in the variables with values of your choice, except for the `POSTGRES_HOST` which should have a value of `"database"` (without the ""). This is required as we're deploying using docker, and we're utilizing docker networks so that containers don't need to access `localhost`.

> [!CAUTION]
> ❗ Don't mess with the default values for `tasks` and `reports` runners inside the global configuration (.yml) file. A minutely interval is recommended.

## Run This Bot

> [!NOTE]
> The following steps apply to all operating systems, so you can run Eris anywhere. Be that Windows, MacOS, or Linux (best for production).

Now it's time to bring Eris to life, and you need to run 3 simple commands to do that:

1. Start all services using docker compose

```bash
sudo docker compose -p "" up -d
```

2. Push the prisma schema to the database

```bash
npx prisma db push
```

3. Restart all services

```bash
sudo docker compose restart
```

If you did everything correctly, you should now have a running (and working) instance of Eris!
If things went wrong somewhere, you can either cry or debug the issue.

## Production

For more information on how to maintain this bot for a production state, please read the [`production guide`](/documentation/Production.md).
