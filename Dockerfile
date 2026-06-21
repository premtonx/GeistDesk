# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Use npm ci to install precise package lock configurations
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine AS runner
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
