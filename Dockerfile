FROM node:22.23.2-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=same-origin
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_EVENTS_BASE_URL=same-origin
ENV VITE_EVENTS_BASE_URL=$VITE_EVENTS_BASE_URL
ARG VITE_ENABLE_TOOL_LINKS=true
ENV VITE_ENABLE_TOOL_LINKS=$VITE_ENABLE_TOOL_LINKS
ARG VITE_ROOT_CONFIG_URL=/lab-root-config.js
ENV VITE_ROOT_CONFIG_URL=$VITE_ROOT_CONFIG_URL
ARG VITE_TOPOLOGY_MFE_URL=/mfe/topology/lab-topology-mfe.js
ENV VITE_TOPOLOGY_MFE_URL=$VITE_TOPOLOGY_MFE_URL
ARG VITE_TRAFFIC_MFE_URL=/mfe/traffic/lab-traffic-mfe.js
ENV VITE_TRAFFIC_MFE_URL=$VITE_TRAFFIC_MFE_URL
RUN npm run build

FROM nginx:1.28.0-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
