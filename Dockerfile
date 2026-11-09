# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY next.config.ts tsconfig.json next-env.d.ts ./
COPY src ./src
COPY public ./public
COPY packages/game-sdk ./packages/game-sdk
COPY scripts/build-sdk.mjs scripts/zip.mjs ./scripts/
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
# Only server dependencies (firebase-admin and Stripe) ship in the runtime image.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build --chown=node:node /app/out ./out
COPY --chown=node:node scripts/preview.mjs scripts/api.mjs scripts/game-api.mjs scripts/game-core.mjs scripts/billing.mjs scripts/locale-redirect.mjs scripts/game-registry.mjs scripts/games-admin.mjs scripts/developer-games.mjs scripts/zip.mjs scripts/platform-store.mjs scripts/mail.mjs scripts/game-stats.mjs scripts/game-reports.mjs scripts/rewards.mjs scripts/upload-keys.mjs scripts/game-seo.mjs ./scripts/
COPY --chown=node:node src/data ./src/data
USER node
EXPOSE 8080
CMD ["node", "scripts/preview.mjs"]
