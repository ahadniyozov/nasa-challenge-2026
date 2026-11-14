# --- build the static web client (vite → apps/web/dist)
FROM node:22-alpine AS build
WORKDIR /app
# package files first, so `npm ci` is cached until dependencies change
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY apps apps
RUN npm run build -w @mission/web

# --- static files served by Caddy: this is the whole game
FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv

# --- optional: game server of the old engineer mode (rooms + leaderboard).
# Built only with `docker compose --profile multiplayer`.
FROM node:22-alpine AS server
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
COPY --from=build /app /app
EXPOSE 8787
CMD ["npm", "start", "-w", "@mission/server"]
