# Database Setup for Charmie

Setting up MongoDB for Charmie isn't rocket science, but it does require some careful steps. Don't worry - I'll guide you through the process.

### Docker Compose Configuration

Here's a `docker-compose.yml` configuration that works like a charm (get it, haha). Just make sure port `27017` is free before you start.

```yml
services:
  charmie-mongodb:
    container_name: charmie-mongodb
    image: mongo:latest
    user: mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: <root username>
      MONGO_INITDB_ROOT_PASSWORD: <root password>
      MONGO_INITDB_DATABASE: <initial database name>
    volumes:
      - charmie-mongodb_data:/data/db
      - ./keyFile:/data/mongodb/keyFile:ro
    command: ['--replSet', 'rs0', '--bind_ip_all', '--keyFile', '/data/mongodb/keyFile']
    ports:
      - '27017:27017'
    restart: unless-stopped

volumes:
  charmie-mongodb_data:
    name: charmie-mongodb_data
    driver: local
```

You'll need to replace these three values:

1. `<root username>`
2. `<root password>`
3. `<initial database name>`

## Setup Guide

This guide is meant for a Unix-like environment, specifically Ubuntu 24 LTS. Take your time and follow along.

### Step 1. Checking Docker Installation

Let's make sure Docker is ready to go:

- `sudo docker -v` (Docker version check)
- `sudo docker-compose -v` (Docker Compose version check)

### Step 2. File Organization

Create a new folder (`.mongodb` works great) to keep your `docker-compose.yml` and related files tidy.

### Step 3. Keyfile Creation

MongoDB needs a keyFile for authentication because we apparently live in the victorian era. Here's how to generate it:

1. Generate keyFile:
   ```bash
   openssl rand -base64 756 > keyFile
   ```
2. Set permissions:
   ```bash
   chmod 400 keyFile
   ```
3. Change ownership:
   ```bash
   sudo chown 999:999 keyFile
   ```

### Step 4. Starting the Container

Fire up the Docker container using this simple command:

```bash
sudo docker-compose up -d
```

### Step 5. Initializing the Replica Set

Prisma requires a MongoDB replica set. 15 seconds after starting the container, run:

```bash
docker exec charmie-mongodb mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})' --username <root username> --password <root password>
```

Just replace `<root username>` & `<root password>` with your chosen values.

### Database URL Setup

Here's a template for the `DATABASE_URL` in your `.env`:

```bash
mongodb://<root user>:<root password>@localhost:27017/<initial database name>?authSource=admin&directConnection=true&replicaSet=rs0
```

Take it step by step, and you'll be up and running in no time. If something goes wrong, take a deep breath and carefully retrace your steps.
