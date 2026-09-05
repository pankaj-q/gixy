# Dockerfile for Gixy AI Risk Manager
# Multi-stage build for smaller production image

# ============================================
# Base Stage - Common dependencies
# ============================================
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# ============================================
# Dependencies Stage - Install all dependencies
# ============================================
FROM base AS deps

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# ============================================
# Development Stage - Install all deps including dev
# ============================================
FROM base AS dev

# Install all dependencies (including devDependencies)
RUN npm ci && npm cache clean --force

# ============================================
# Build Stage - Not needed for this Node.js app (no build step)
# But keeping structure for future build steps
# ============================================
FROM base AS builder

# Copy all dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# ============================================
# Production Stage - Minimal runtime image
# ============================================
FROM node:20-alpine AS production

# Install dumb-init and curl for health checks
RUN apk add --no-cache dumb-init curl

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs package.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3007/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/server.mjs"]