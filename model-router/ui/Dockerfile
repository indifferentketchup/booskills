# Build context must be the model-router/ directory (parent of ui/) so the image
# includes both the Next app (ui/) and the router script (router.mjs) it execs.
#
#   docker compose -f ui/docker-compose.yml up -d --build   (from model-router/)
#
# Paths are env-driven (PASEO_DIR, ROUTER_PATH); ~/.paseo is bind-mounted in at
# PASEO_DIR. Runs as the image's built-in `node` user (uid 1000) so writes to the
# mounted config stay owned by the host user.

FROM node:24-slim AS build
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production \
    PASEO_DIR=/data/paseo \
    ROUTER_PATH=/app/router.mjs
WORKDIR /app/ui
COPY --from=build --chown=node:node /app/ui ./
COPY --chown=node:node router.mjs /app/router.mjs
COPY --chown=node:node load-ledger.mjs /app/load-ledger.mjs
USER node
EXPOSE 4319
CMD ["npm", "run", "start"]
