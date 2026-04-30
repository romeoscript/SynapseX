FROM ubuntu:24.04 AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates nodejs npm && rm -rf /var/lib/apt/lists/*
RUN npm install -g corepack && corepack enable && corepack prepare pnpm@latest --activate

# Install onchainos CLI (requires GLIBC 2.39 → Ubuntu 24.04)
RUN curl -fsSL https://github.com/okx/onchainos-skills/releases/download/v2.2.1/onchainos-x86_64-unknown-linux-gnu \
    -o /usr/local/bin/onchainos && chmod +x /usr/local/bin/onchainos

# ------- deps -------
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY agents/publisher-ethy/package.json agents/publisher-ethy/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ------- runner -------
FROM base AS runner
WORKDIR /app

COPY --from=deps /app/ ./
COPY agents/publisher-ethy/ agents/publisher-ethy/
COPY packages/shared/ packages/shared/

ENV NODE_ENV=production

CMD ["npx", "tsx", "agents/publisher-ethy/src/index.ts"]
