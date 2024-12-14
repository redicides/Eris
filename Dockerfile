# Base image
FROM node:22.12 AS base
WORKDIR /charmie

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
COPY --from=build /charmie/prisma ./prisma

USER daemon
ENTRYPOINT [ "npm", "run", "start" ]
