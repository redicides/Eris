# Production Environment

Once you have a working instance of Charmie, it's important to understand how to update and maintain it. Charmie is suited for a production environment using Docker, so this guide focuses on that setup only.

## Docker Commands

> [!NOTE]
> All of the commands mentioned in this file must be ran in Charmie's **root directory**, aka where the `.env` and `charmie.cfg.yml` files are. They are rather useful and I recommend you get familiar with them.

### Running All Services

```bash
sudo docker compose up -d
```

### Shutting Down All Services

```bash
sudo docker compose down
```

### Stopping All Services

```bash
sudo docker compose stop
```

### Re-starting All Services

```bash
sudo docker compose restart
```

### Re-building All Services

```bash
sudo docker compose build
```

### Viewing Service Logs

```bash
sudo docker logs <container-id/name>
```

> [!TIP]
> Use `sudo docker ps` to get a list of all running containers, along with their names and IDs.

## Bot Updates

If you've directly cloned this repository (good thing to do for a production environment), you'll want to know how to update the bot files whenever I push an update/new commit.

We're using `git` for this example, but you can also update files manually if you're into that for some reason.

1. Shut down all services

```bash
sudo docker compose down
```

2. Update the files

```bash
git pull
```

3. Rebuild the bot

```bash
sudo docker compose build
```

4. Re-run the bot

```bash
sudo docker compose up -d
```

## Database Updates

In the event that I push an update that requires migrating data to a newer format, or pushing a new schema to the database, you'll need to know how to do this.

Before you do anything though, you need to make sure the database service (postgresql-charmie) is running without problems, and that `DATABASE_URL` is defined in your `.env` file.

### Migrating Data

1. Shut down the bot service

```bash
sudo docker stop bot-charmie
```

2. Run the migration command

```bash
npx prisma migrate deploy
```

### Pushing Schema Changes

1. Shut down the bot service

```bash
sudo docker stop bot-charmie
```

2. Run the push command

```bash
npx prisma db push
```
