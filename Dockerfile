FROM node:22-alpine AS base

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Dependencies stage
FROM base AS deps

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

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
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-lock.yaml /app/pnpm-lock.yaml

# Copy node_modules from deps to avoid rebuilding native extensions
COPY --from=deps /app/node_modules /app/node_modules

# Prune dev dependencies
RUN pnpm prune --prod

# Create tmp directory for sqlite
RUN mkdir -p tmp

EXPOSE 3333
CMD ["node", "bin/server.js"]
