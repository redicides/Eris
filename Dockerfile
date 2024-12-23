# Base image
FROM node:22.12 AS base
WORKDIR /terabyte

# Install dependencies
FROM base AS install
COPY package.json bun.lockb ./
RUN npm install --no-package-lock --verbose

# Build the project and generate Prisma client
FROM base AS build
COPY . .
COPY --from=install /terabyte/node_modules ./node_modules
RUN npx prisma generate
RUN npm run compile

# Release image
FROM base AS release
COPY --from=build /terabyte/node_modules ./node_modules
COPY --from=install /terabyte/package.json ./package.json
COPY --from=build /terabyte/dist ./dist
COPY --from=build /terabyte/src ./src
COPY --from=build /terabyte/prisma ./prisma

USER daemon
ENTRYPOINT [ "npm", "run", "start" ]
