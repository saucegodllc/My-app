FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests for install
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Build
WORKDIR /app/artifacts/api-server
RUN pnpm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/artifacts/api-server/dist ./dist
COPY --from=base /app/lib ./lib

ENV NODE_ENV=production
ENV PORT=8080
ENV CONNECTSPHERE_LOCAL_DB_FALLBACK=0

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
