# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The commit the footer shows with the version (docker build --build-arg).
ARG GIT_COMMIT=""
ENV GIT_COMMIT=$GIT_COMMIT
COPY package.json package-lock.json ./
RUN npm ci
COPY next.config.ts tsconfig.json next-env.d.ts ./
COPY src ./src
COPY public ./public
COPY packages/game-sdk ./packages/game-sdk
COPY locales ./locales
COPY scripts/build-sdk.mjs scripts/build-locales.mjs scripts/zip.mjs ./scripts/
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
# Fonts for the pictures of challenge links (scripts/share-card.mjs), which
# name players and games in Chinese, Japanese and Korean too.
RUN apk add --no-cache font-noto-cjk
# Only server dependencies (firebase-admin, Stripe and resvg, which draws
# the challenge pictures) ship in the runtime image.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
# No reward system ships in the image: the server runs the live plugin
# version's rules, loaded at run time (scripts/reward-plugin.mjs).
COPY --from=build --chown=node:node /app/out ./out
COPY --chown=node:node scripts/preview.mjs scripts/api.mjs scripts/game-api.mjs scripts/game-core.mjs scripts/billing.mjs scripts/locale-redirect.mjs scripts/game-registry.mjs scripts/games-admin.mjs scripts/developer-games.mjs scripts/zip.mjs scripts/platform-store.mjs scripts/mail.mjs scripts/game-stats.mjs scripts/game-reports.mjs scripts/rewards.mjs scripts/kingdom.mjs scripts/reward-releases.mjs scripts/reward-systems.mjs scripts/reward-plugin.mjs scripts/funnel.mjs scripts/challenges.mjs scripts/referrals.mjs scripts/player-photos.mjs scripts/test-accounts.mjs scripts/roles.mjs scripts/upload-keys.mjs scripts/game-seo.mjs scripts/site-settings.mjs scripts/i18n.mjs scripts/share-card.mjs ./scripts/
COPY --chown=node:node src/data ./src/data
# The language packs, for the pages and previews the server fills in.
COPY --chown=node:node locales ./locales
USER node
EXPOSE 8080
CMD ["node", "scripts/preview.mjs"]
