# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=secret,id=env_production \
  while IFS= read -r line || [ -n "$line" ]; do \
    case "$line" in ''|\#*) continue ;; esac; \
    key="${line%%=*}"; \
    value="${line#*=}"; \
    export "$key=$value"; \
  done < /run/secrets/env_production && \
  npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3747

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/src ./src

RUN npm prune --omit=dev

EXPOSE 3747
CMD ["npm", "start"]
