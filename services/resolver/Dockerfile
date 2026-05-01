FROM node:20-slim

RUN npm install -g corepack && corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY services/resolver/package.json ./
RUN pnpm install

COPY services/resolver/index.ts ./

CMD ["npx", "tsx", "index.ts"]
