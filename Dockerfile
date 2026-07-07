# Production runtime image.
# Expects a pre-built dist/ directory in the build context (produced by CI via
# `npm run build` and uploaded as a deploy artifact). This avoids rebuilding
# Vite + TypeScript on the production host, which previously exceeded SSH timeouts.

FROM node:24-alpine AS runner
WORKDIR /app

ARG BUILD_ID=local
ENV BUILD_ID=$BUILD_ID
ENV NODE_ENV=production

COPY package*.json .npmrc ./
RUN npm ci --omit=dev --dangerously-allow-all-scripts --no-audit

COPY dist ./dist
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
