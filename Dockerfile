# Image de production du site (à construire depuis le dépôt suivi-agent-frontend).
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared ./shared
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_PLATFORM_PATH=
ARG VITE_TILE_URL=
ARG VITE_SOCKET_URL=
ENV VITE_PLATFORM_PATH=$VITE_PLATFORM_PATH VITE_TILE_URL=$VITE_TILE_URL VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
