FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app    
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG GIT_SHA=dev
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_API_URL=http://backend:8000/api
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_NAME=Synapse
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
