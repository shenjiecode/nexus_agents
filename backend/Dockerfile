# Backend Dockerfile - Nexus Agents API
# Multi-stage build for minimal production image

# ============ Builder Stage ============
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install pnpm and dependencies (no lockfile in backend dir)
RUN corepack enable pnpm && pnpm install --ignore-scripts

# Copy source code and configs
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN pnpm build

# ============ Production Stage ============
FROM node:24-alpine AS production

WORKDIR /app

# Install production dependencies
COPY package.json ./
RUN corepack enable pnpm && pnpm install --prod --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Environment defaults
ENV NODE_ENV=production
ENV PORT=13207

# Expose port
EXPOSE 13207

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:13207/health || exit 1

# Start server
CMD ["node", "dist/index.js"]