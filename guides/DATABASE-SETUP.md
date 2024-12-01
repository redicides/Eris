# Database Setup

Charmie uses MongoDB as its database provider. Setting up MongoDB can be challenging without using a Docker container, especially when specific requirements for Prisma are involved. This guide will help you configure MongoDB efficiently for your project.

### docker-compose.yml

To assist you with setting up your database, I provide the `docker-compose.yml` configuration that I personally use. While this configuration is not perfect, it currently works as expected.

This configuration uses port `27017` on your host, so ensure no other processes are running on that port.

```yml
services:
  charmie-mongodb:
    container_name: charmie-mongodb
    image: mongo:latest
    user: mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: <root username>
      MONGO_INITDB_ROOT_PASSWORD: <password of your choice>
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

You'll need to replace 3 values with ones of your choice:

1. `<root username>`
2. `<password of your choice/root password>`
3. `<initial database name>`

## Setup

This guide provides setup instructions for a Unix-like environment, specifically tailored for Ubuntu 24 LTS. It is important to follow each of the steps carefully to ensure a successful installation process.

### Step 1. Installation

Before you attempt to run the database, it's essential to make sure that both `docker` and `docker-compose` are installed on your machine. There are various methods to install them, so feel free to choose the one that works best for you.

Once installed, you can verify the installation by running the following commands:

- `sudo docker -v` to check the Docker version.
- `sudo docker-compose -v` to check the Docker Compose version.

### Step 2. File Setup

Create a new folder where you will store the `docker-compose.yml` file and other necessary files for the setup. This will help keep your project organized and ensure that all the required files are in a single location. I recommend using `.momgodb` as the folder name.

### Step 3. Keyfile

MongoDB requires a keyFile for authentication. Generating this keyFile is straightforward. Follow the steps below to create it, ensuring it is in the same directory where your `docker-compose.yml` file is located:

1. Run the command to generate the keyFile:
   ```bash
   openssl rand -base64 756 > keyFile
   ```
2. Set the correct permissions for the keyFile:
   ```bash
   chmod 400 keyFile
   ```
3. Change the ownership of the keyFile to the correct user and group:
   ```bash
   sudo chown 999:999 keyFile
   ```

### Step 4. Starting the Container

After completing all the previous steps, you can now start the Docker container by running:

```bash
sudo docker-compose up -d
```

### Step 5. Initializing the Replica Set

Prisma requires a MongoDB replica set to support nested writes. About 15 seconds after starting the container, run the following command to initialize the replica set:

```bash
docker exec charmie-mongodb mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})' --username <root username> --password <root password>
```

Be sure to replace `<root username>` & `<root password>` with the values you filled in the `docker-compose.yml` file.

That's it! If you've carefully followed each of the steps, your MongoDB database container should now be up and running without any issues. If something went wrong during the setup, you'll need to troubleshoot the problem and identify where things went off track. This may involve checking logs, verifying configurations, or re-evaluating any steps that might have been missed.

### Database URL

You can use this template to generate the `DATABASE_URL` variable used in the `.env` file:

```bash
mongodb://<root user>:<root username>@localhost:27017/<initial database name>?authSource=admin&directConnection=true&replicaSet=rs0
```
