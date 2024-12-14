# This service is purely used to make sure the database service matches the prisma schema upon the first ever deployment.
# It has no other use.

FROM node:22.12
WORKDIR /db/deploy

# Install prisma and @prisma/client
RUN npm install prisma @prisma/client --no-package-lock --verbose

# Copy the Prisma schema
COPY ../../prisma/schema.prisma ./prisma/schema.prisma

# Set the database URL (at runtime)
ENV DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

# Command to push the schema to the database
CMD ["npx", "prisma", "db", "push"]
