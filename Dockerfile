# Base image
FROM node:latest AS base
WORKDIR /charmie

# Environment variables
ARG BOT_TOKEN
ARG BOT_ID
ARG DATABASE_URL
ARG SENTRY_DSN

ENV BOT_TOKEN=$BOT_TOKEN
ENV BOT_ID=$BOT_ID
ENV DATABASE_URL=$DATABASE_URL
ENV SENTRY_DSN=$SENTRY_DSN

# Install dependencies
FROM base AS install
COPY package.json bun.lockb ./
RUN npm install --no-package-lock --verbose

# Build the project and generate Prisma client
FROM base AS build
COPY . .
COPY --from=install /charmie/node_modules ./node_modules
RUN npx prisma generate
RUN npm run compile

# Release image
FROM base AS release
COPY --from=build /charmie/node_modules ./node_modules
COPY --from=install /charmie/package.json ./package.json
COPY --from=build /charmie/dist ./dist
COPY --from=build /charmie/src ./src

USER daemon
ENTRYPOINT [ "node", "dist/index.js" ]
