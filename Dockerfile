FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG VITE_ADMIN_URL
ARG VITE_RANKING_URL
ARG VITE_MAIN_SITE_URL
ARG VITE_API_BASE=https://api.accsaber.com/v1
ARG VITE_WS_BASE=wss://api.accsaber.com/ws/scores
RUN VITE_API_BASE=$VITE_API_BASE VITE_WS_BASE=$VITE_WS_BASE npm run build-only

FROM nginx:alpine
COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["/bin/sh", "-c", "test -n \"$API_PROXY_TARGET\" || { echo 'ERROR: API_PROXY_TARGET is required'; exit 1; } && envsubst '${API_PROXY_TARGET}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
