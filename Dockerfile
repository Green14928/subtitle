# Next.js 16 standalone Dockerfile for Zeabur
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL provided at build-time for prisma generate
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN node scripts/prepare-prisma.js && npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

# Next standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma runtime: client + engine + schema
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Uploads directory (dev stub; production should use cloud storage)
RUN mkdir -p /app/uploads

EXPOSE 3002

# On container start: ensure schema is switched for postgres, apply migrations, then run server
CMD ["sh", "-c", "node scripts/prepare-prisma.js && npx prisma db push --accept-data-loss --skip-generate && node server.js"]
