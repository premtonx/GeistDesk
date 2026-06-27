# Build Stage
FROM node:24-alpine AS builder
WORKDIR /app
ARG BUILD_ID=local
ENV BUILD_ID=$BUILD_ID
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run lint && node scripts/verify-no-react-namespace.mjs && npm run build && node scripts/verify-production-build.mjs

# Production Stage
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built artifacts from the build stage
COPY --from=builder /app/dist ./dist

# Standard express server port configuration
EXPOSE 3000

# Set the start command to launch our bundled high-performance commonJS node server code
CMD ["node", "dist/server.cjs"]
