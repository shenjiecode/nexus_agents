# Frontend Dockerfile - Nexus Agents Web UI
# Multi-stage build with nginx for static serving

# ============ Builder Stage ============
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install npm (corepack) and dependencies
# Use npm instead of pnpm to avoid approve-builds issues with esbuild
RUN corepack enable npm && npm install

# Copy source code and configs
COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src/ ./src/

# Build static files
RUN npm run build

# ============ Production Stage ============
FROM nginx:alpine AS production

# Install envsubst for runtime config substitution
RUN apk add --no-cache gettext

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# Entry point handles env substitution
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]