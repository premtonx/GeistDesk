# Build Stage
FROM node:24-alpine AS builder
WORKDIR /app
ARG BUILD_ID=local
ENV BUILD_ID=$BUILD_ID
COPY package*.json .npmrc ./
RUN npm ci --dangerously-allow-all-scripts --no-audit
COPY . .
RUN npm run lint && node scripts/verify-no-react-namespace.mjs && npm run build && node scripts/verify-production-build.mjs

# Production Stage
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json .npmrc ./
RUN npm ci --omit=dev --dangerously-allow-all-scripts --no-audit

# Copy built artifacts from the build stage
COPY --from=builder /app/dist ./dist

# Production entrypoint: wait for DB → schema deploy → seed → start server
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Standard express server port configuration
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
