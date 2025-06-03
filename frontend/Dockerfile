FROM node:24-alpine AS build

WORKDIR /build
COPY . .
ARG VERSION='v1.0.0'
RUN npm install --legacy-peer-deps && \
    node pre-build.js --version ${VERSION} && \
    NODE_OPTIONS=--max_old_space_size=8048 npm run build-prod

FROM nginx:stable-alpine AS runner

RUN apk --no-cache add bash

WORKDIR /app

COPY --from=build /build/dist/flowide-ui /usr/share/nginx/html

COPY --from=build /build/config.sh ./

ARG SERVER
ARG DOMAIN
RUN ./config.sh

HEALTHCHECK --interval=1m --timeout=30s --start-period=5s --retries=3 \
            CMD curl -f http://localhost/ || exit 1