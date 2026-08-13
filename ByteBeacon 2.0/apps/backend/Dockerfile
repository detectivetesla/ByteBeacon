# Stage 1: Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Enable corepack and pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy root workspace configurations
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/

# Install all dependencies including devDependencies for build
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared package then backend
RUN pnpm --filter @bytebeacon/shared build && pnpm --filter @bytebeacon/backend build

# Stage 2: Production runner stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

# Create non-root system user and group
RUN addgroup -S bytebeacon && adduser -S bytebeacon -G bytebeacon

# Copy built dist files and package manifests
COPY --from=builder --chown=bytebeacon:bytebeacon /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=bytebeacon:bytebeacon /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=bytebeacon:bytebeacon /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=bytebeacon:bytebeacon /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=bytebeacon:bytebeacon /app/package.json /app/pnpm-workspace.yaml ./

# Enable corepack to install production dependencies only
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
    && pnpm install --prod --frozen-lockfile

USER bytebeacon

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/backend/dist/index.js"]
