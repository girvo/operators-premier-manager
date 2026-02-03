FROM node:22-alpine AS base

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Dependencies stage (all deps for building)
FROM base AS deps

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml ./

# Approve native build scripts
RUN pnpm approve-builds better-sqlite3 esbuild
RUN pnpm install --frozen-lockfile

# Production dependencies stage (prod deps only, built fresh)
FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml ./
RUN pnpm approve-builds better-sqlite3
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
