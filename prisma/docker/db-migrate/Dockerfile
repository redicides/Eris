# This service is used to migrate database data to a newer format in case of schema changes.
# It has no other use.

FROM node:latest
WORKDIR /db/migrate

# Install prisma and @prisma/client
RUN npm install prisma @prisma/client --no-package-lock --verbose

# Copy the Prisma schema and the migrations directory
COPY ../../prisma ./prisma

# Set the database URL (at runtime)
ENV DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

# Command to run migrations
CMD ["npx", "prisma", "migrate", "deploy"]
