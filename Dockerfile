# Base image
FROM node:22.12 AS base
WORKDIR /eris

# Install dependencies
FROM base AS install
COPY package.json bun.lockb ./
RUN npm install --no-package-lock --verbose

# Build the project and generate Prisma client
FROM base AS build
COPY . .
COPY --from=install /eris/node_modules ./node_modules
RUN npx prisma generate
RUN npm run compile

# Release image
FROM base AS release
COPY --from=build /eris/node_modules ./node_modules
COPY --from=install /eris/package.json ./package.json
COPY --from=build /eris/dist ./dist
COPY --from=build /eris/src ./src
COPY --from=build /eris/prisma ./prisma

USER daemon
ENTRYPOINT [ "npm", "run", "start" ]
