# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY next.config.ts tsconfig.json next-env.d.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build --chown=node:node /app/out ./out
COPY --chown=node:node scripts/preview.mjs ./scripts/preview.mjs
USER node
EXPOSE 8080
CMD ["node", "scripts/preview.mjs"]
