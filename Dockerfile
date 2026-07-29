# syntax=docker/dockerfile:1

FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --no-audit --no-fund


FROM node:20-slim AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public
RUN npm run build


FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN useradd --create-home --shell /usr/sbin/nologin appuser

COPY --from=build --chown=appuser:appuser /app/public ./public
COPY --from=build --chown=appuser:appuser /app/.next/standalone ./
COPY --from=build --chown=appuser:appuser /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

CMD ["node", "server.js"]