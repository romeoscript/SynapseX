FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ------- deps -------
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/arena/package.json apps/arena/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ------- build -------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./

COPY apps/arena/ apps/arena/
COPY packages/shared/ packages/shared/

WORKDIR /app/apps/arena
RUN pnpm build

# ------- runner -------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/arena/public ./apps/arena/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/arena/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/arena/.next/static ./apps/arena/.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/arena/server.js"]
