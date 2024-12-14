# Production Environment

Once you have a working instance of Charmie, it's important to understand how to update and maintain it. Charmie is suited for a production environment using Docker, so this guide focuses on that setup only.

## Docker Commands

These are a few useful commands that will perform certain actions. I recommend you get familiar with them.

> [!NOTE]
> The provided commands must be ran in Charmie's **root directory**, aka where the `.env` and `charmie.cfg.yml` files are.

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

### Re-building All Services

```bash
sudo docker compose build
```

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

In the event that I push an update that requires migrating data to a newer format, or pushing a new schema to the database, you'll need to know how to do this. Before you do anything though, you need to make sure the database service (postgresql-charmie) is running without problems.

### Migrating Data

1. Shut down the bot service

```bash
sudo docker stop bot-charmie
```

2. Build the migration image

```bash
sudo docker build -t charmie-db-migration /prisma/docker/db-migrate
```

3. Run the migration image

```bash
sudo docker run -d --name charmie-db-migration --env-file .env --network charmie charmie-db-migration
```

### Pushing Schema Changes

1. Shut down the bot service

```bash
sudo docker stop bot-charmie
```

2. Build the deployment image

```bash
sudo docker build -t charmie-db-deployment /prisma/docker/db-push
```

3. Run the deployment image

```bash
sudo docker run -d --name charmie-db-deployment --env-file .env --network charmie charmie-db-deployment
```
