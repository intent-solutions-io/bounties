# Simple production Dockerfile for pre-built Next.js standalone (monorepo)
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build (preserves monorepo structure)
COPY .next/standalone ./
COPY .next/static ./apps/dashboard/.next/static
COPY public ./apps/dashboard/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Server.js is in apps/dashboard/ due to monorepo structure
WORKDIR /app/apps/dashboard
CMD ["node", "server.js"]
