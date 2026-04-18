# Cloud Run uses linux/amd64. Without this, builds on Apple Silicon produce arm64 images and
# the container fails with "exec format error" (even for /bin/sh).
FROM --platform=linux/amd64 node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npx prisma generate && yarn build

# Production image
FROM --platform=linux/amd64 node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist/prisma.config.js ./prisma.config.js

COPY docker-entrypoint.sh ./

EXPOSE 8080

# Invoke via sh so CRLF/shebang issues on Windows do not cause "exec format error" in Linux.
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
