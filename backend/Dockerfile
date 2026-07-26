# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache tini

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001

# Copy dependencies
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --chown=nodeapp:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown nodeapp:nodejs logs

USER nodeapp

EXPOSE 8080

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1
