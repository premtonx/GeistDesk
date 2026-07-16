# GeistDesk multi-stage production image.
# Stage 1 builds Vite frontend + esbuild server bundles.
# Stage 2 runs a minimal Node Alpine runtime with migrate/seed entrypoint.

# -----------------------------------------------------------------------------
# Builder
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

# Native build tooling for optional native deps (argon2-adjacent / wasm tooling).
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit

COPY . .
# Bake public Vite flags at build time (override via --build-arg).
ARG VITE_DEMO_MODE=false
ARG VITE_BETA_AUTO_ADMIN=false
ARG VITE_OLLAMA_ENDPOINT=
ARG VITE_MASTER_KEY_SALT=
ARG VITE_PUBLIC_APP_URL=
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE \
    VITE_BETA_AUTO_ADMIN=$VITE_BETA_AUTO_ADMIN \
    VITE_OLLAMA_ENDPOINT=$VITE_OLLAMA_ENDPOINT \
    VITE_MASTER_KEY_SALT=$VITE_MASTER_KEY_SALT \
    VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL \
    NODE_ENV=production

RUN npm run build

# -----------------------------------------------------------------------------
# Runner
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ARG BUILD_ID=local
ENV BUILD_ID=$BUILD_ID \
    NODE_ENV=production \
    PORT=3000

# Production node_modules only (express, pg, imap-simple, etc. are externalized).
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --no-audit \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && addgroup -S geistdesk \
  && adduser -S geistdesk -G geistdesk \
  && chown -R geistdesk:geistdesk /app

USER geistdesk

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
