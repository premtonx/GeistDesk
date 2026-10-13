# GeistDesk multi-stage image — builds UI + API from a clean Git clone.
#
# Targets:
#   backend  — Node/Express production gateway (API + SPA fallback, SMTP :25)
#   frontend — Nginx serving Vite static assets (for Caddy reverse-proxy stacks)
#   runner   — alias of backend (legacy compose / CI)
#
#   docker compose build
#   ./install.sh

# -----------------------------------------------------------------------------
# Stage 1 — builder
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl libc6-compat

COPY package.json package-lock.json .npmrc ./
RUN npm ci --dangerously-allow-all-scripts --no-audit

COPY . .

# prisma generate only needs a placeholder URL (no live DB in the builder).
ARG DATABASE_URL=postgresql://geist_user:geist_password@127.0.0.1:5432/geistdesk_prod?schema=public
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate

ARG VITE_DEMO_MODE=false
ARG VITE_ENABLE_DEMO_LOGIN=false
ARG VITE_BETA_AUTO_ADMIN=false
ARG VITE_OLLAMA_ENDPOINT=
ARG VITE_MASTER_KEY_SALT=
ARG VITE_PUBLIC_APP_URL=
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE \
    VITE_ENABLE_DEMO_LOGIN=$VITE_ENABLE_DEMO_LOGIN \
    VITE_BETA_AUTO_ADMIN=$VITE_BETA_AUTO_ADMIN \
    VITE_OLLAMA_ENDPOINT=$VITE_OLLAMA_ENDPOINT \
    VITE_MASTER_KEY_SALT=$VITE_MASTER_KEY_SALT \
    VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL \
    NODE_ENV=production

RUN npm run build \
  && test -f dist/index.html \
  && test -f dist/server.cjs \
  && test -f dist/migrate.cjs \
  && test -f dist/seed.cjs \
  && test -f dist/seed-demo.cjs

RUN npm prune --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 2 — backend (API gateway)
# -----------------------------------------------------------------------------
FROM node:24-alpine AS backend
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ARG BUILD_ID=local
ENV BUILD_ID=$BUILD_ID \
    NODE_ENV=production \
    PORT=5000

COPY --from=builder /app/package.json /app/package-lock.json /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# API + inbound SMTP (MX). Only exposed on the compose network unless mapped.
EXPOSE 5000 25

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Legacy alias used by older compose / CI references.
FROM backend AS runner

# -----------------------------------------------------------------------------
# Stage 3 — frontend (static Vite build behind Caddy)
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS frontend
COPY deploy/nginx-frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/ /usr/share/nginx/html/
# Drop Node server bundles from the static root (API is the backend service).
RUN rm -f /usr/share/nginx/html/server.cjs \
          /usr/share/nginx/html/migrate.cjs \
          /usr/share/nginx/html/seed.cjs \
          /usr/share/nginx/html/seed-demo.cjs \
          /usr/share/nginx/html/*.map 2>/dev/null || true
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
