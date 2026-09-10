# GeistDesk multi-stage image — builds frontend + backend inside Docker.
# A clean Git clone with no host node_modules/ or dist/ is enough:
#   ./setup.sh
#   docker compose up --build -d

# -----------------------------------------------------------------------------
# Stage 1 — builder: full install (incl. devDependencies), Prisma client, dist/
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl libc6-compat

COPY package.json package-lock.json .npmrc ./
RUN npm ci --dangerously-allow-all-scripts --no-audit

COPY . .

# prisma generate reads DATABASE_URL from the schema datasource; this value is
# only used at generate time (no live database required in the builder).
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

# Production node_modules for the runner (keeps generated Prisma client).
RUN npm prune --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 2 — runner: slim production image
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ARG BUILD_ID=local
ENV BUILD_ID=$BUILD_ID \
    NODE_ENV=production \
    PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000 25

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
