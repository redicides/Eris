# Self Hosting

So, you want to self-host Charmie? Alright then, get ready for a super streamlined process thanks to `docker` & `docker compose`.

## Prerequisites

- `docker` & `docker compose`
- Sentry Project (for error logging)

## Configuration & Environment Variables

Charmie's got a few specific environment and global configuration settings. You'll need two magical files: `.env` and `charmie.cfg.yml`. A little cron knowledge will help you out here, as we're using the [cron npm package](https://www.npmjs.com/package/cron) to automate some tasks.

Grab those example files [`config.example.yml`](/config.example.yml) and [`.env.example`](/.env.example), for the required values. Rename `config.example.yml` to `charmie.cfg.yml` and `.env.example` to `.env`.

You can fill in the variables with values of your choice, except for the `POSTGRES_HOST` which should have a value of **database**. This is crucial as we're deploying using docker, and we're utilizing docker networks so our container doesn't need to access `localhost`.

> [!NOTE]
> ❗ Don't mess with the default values for `tasks` and `reports` runners inside the global configuration (.yml) file. A minutely interval is recommended.

## Run This Bot

Now it's time to bring Charmie to life, and you need to run 2 simple commands to do that:

1. Push the prisma schema to the database

```bash
npx prisma db push
```

2. Start all services using docker compose

```bash
sudo docker compose up -d
```

If you did everything correctly, you should now have a running (and working) instance of Charmie!
If things went wrong somewhere, you can either cry or debug the issue.

## Production

For more information on how to maintain this bot for a production state, please read the [`production guide`](/documentation/Production.md).
