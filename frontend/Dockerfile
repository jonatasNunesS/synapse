# ════════════════════════════════════════════════════════════
# Synapse Frontend — Multi-stage Dockerfile
# Stage 1 (deps): instalar dependências com pnpm
# Stage 2 (builder): build da aplicação Next.js
# Stage 3 (runner): imagem final enxuta com standalone output
# ════════════════════════════════════════════════════════════

# ── Stage 1: Dependências ────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm@9

# Copiar arquivos de lockfile e instalar dependências
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Builder ─────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN npm install -g pnpm@9

# Copiar node_modules do stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis de build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=http://backend:8000
ENV NEXT_PUBLIC_APP_NAME=Synapse

# pnpm install already handles dependencies


# Build da aplicação (output: standalone configurado em next.config.mjs)
RUN pnpm build

# ── Stage 3: Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar apenas o necessário para a imagem final
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Ajustar permissões
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
