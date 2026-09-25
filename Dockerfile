# Choresome — production image.
#
# Uses a full `node_modules` (not Next's "standalone" output) and plain
# `next start`, trading a larger image for a much simpler, more reliable
# setup — this avoids the well-known class of bugs where standalone's
# dependency tracing misses Prisma's native query-engine binary. That
# trade-off is the right one for a small self-hosted household app; it is
# not a concern that outweighs reliability here.

FROM node:22-bookworm-slim AS base
WORKDIR /app
# Prisma's query engine needs libssl to run; Debian's "slim" image strips it out.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL isn't needed to build (no DB access at build time), but Prisma's
# generator requires the env var to be defined.
ENV DATABASE_URL="file:./build-placeholder.db"
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
