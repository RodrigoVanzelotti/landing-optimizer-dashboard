# syntax=docker/dockerfile:1

FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --no-audit --no-fund


FROM deps AS development
WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV WATCHPACK_POLLING=true

COPY . .
RUN mkdir -p public

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]


FROM node:22-slim AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ARG API_URL=http://localhost:3001/v1
ENV API_URL=${API_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public
RUN npm test -- --pool=forks --poolOptions.forks.singleFork && npm run build
RUN test -f .next/standalone/server.js


FROM node:22-slim AS runtime
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
