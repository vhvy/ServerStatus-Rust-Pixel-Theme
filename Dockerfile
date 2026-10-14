FROM --platform=$BUILDPLATFORM ghcr.io/pnpm/pnpm:12.10.1 AS build

WORKDIR /app
# The official pnpm image contains the standalone binary, without Node.js.
RUN pnpm runtime set node 24 -g
COPY web/package.json web/pnpm-lock.yaml ./
# Keep the dependency cache separate from pnpm's managed Node.js runtime.
RUN --mount=type=cache,id=pixel-theme-pnpm,target=/var/cache/pnpm \
    pnpm install --store-dir /var/cache/pnpm --frozen-lockfile
COPY web/index.html web/vite.config.ts web/tsconfig*.json ./
COPY web/src/ ./src/
COPY web/public/ ./public/
RUN pnpm test && pnpm build

FROM nginx:stable-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /opt/ServerStatus/web/

EXPOSE 80
