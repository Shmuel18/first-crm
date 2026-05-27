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
  node -e "const fs=require('fs'); const q=(v)=>String(v).replace(/'/g, '\\''\"'\"'\\''); for (const line of fs.readFileSync('/run/secrets/env_production','utf8').split(/\\r?\\n/)) { const s=line.trim(); if (!s || s.startsWith('#')) continue; const i=s.indexOf('='); if (i<1) continue; const k=s.slice(0,i).trim(); const v=s.slice(i+1); if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) console.log(`export ${k}='${q(v)}'`); }" > /tmp/build-env.sh && \
  . /tmp/build-env.sh && \
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
