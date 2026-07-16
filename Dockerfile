# Production runtime image (CI / host deploy model).
# Expects a pre-built dist/ in the build context (produced by CI via
# `npm run build` and synced to the host). This avoids rebuilding Vite on the
# production server (SSH timeouts) and matches the deploy script:
#   docker compose build --build-arg BUILD_ID=... geistdesk-gateway
#
# For a full in-Docker build from source, use: docker build -f Dockerfile.multistage .

FROM node:24-alpine AS runner
WORKDIR /app

ARG BUILD_ID=local
ENV BUILD_ID=$BUILD_ID \
    NODE_ENV=production \
    PORT=3000

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --dangerously-allow-all-scripts --no-audit \
  && npm cache clean --force

COPY dist ./dist
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
