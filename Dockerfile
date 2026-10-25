FROM node:22.23.4-alpine AS base

# Install the project's pinned pnpm version via corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
COPY package.json ./
RUN corepack enable && corepack install

# Dependencies stage (all deps for building)
FROM base AS deps

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Production dependencies stage (prod deps only, built fresh)
FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN node ace build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/build /app
COPY --from=prod-deps /app/node_modules /app/node_modules

# Create tmp directory for sqlite
RUN mkdir -p tmp

EXPOSE 3333
CMD ["node", "bin/server.js"]
