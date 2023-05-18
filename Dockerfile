FROM node:alpine AS base

# build the frontend

RUN npm i -g pnpm
RUN apk --no-cache add --virtual build-deps build-base

FROM base AS frontend-dependencies

WORKDIR /app/
COPY ./frontend/package.json ./frontend/pnpm-lock.yaml ./
RUN pnpm i -P
RUN apk del build-deps

FROM base AS frontend-build

WORKDIR /app/
COPY ./frontend .
COPY --from=frontend-dependencies /app/node_modules ./node_modules
RUN pnpm run build
RUN pnpm prune --prod

FROM base AS server-dependencies

WORKDIR /app/
COPY ./server/package.json ./server/pnpm-lock.yaml ./
RUN pnpm i -P
RUN apk del build-deps

FROM base AS server-build

WORKDIR /app/
COPY ./server .
COPY --from=server-dependencies /app/node_modules ./node_modules
RUN pnpm run build
RUN pnpm prune --prod

FROM base AS deploy

WORKDIR /app/
COPY /server/package.json /server/pnpm-lock.yaml ./server/
COPY --from=frontend-build /app/dist ./frontend/dist
COPY --from=server-build /app/node_modules ./server/node_modules
COPY --from=server-build /app/built ./server/built
COPY --from=server-build /app/config.json ./server/config.json

WORKDIR /app/server/

EXPOSE 3001
CMD ["pnpm", "start"]