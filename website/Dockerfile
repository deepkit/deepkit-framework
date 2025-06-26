FROM node:24-alpine3.20
ENV TZ="Europe/Berlin"

RUN mkdir /app/
WORKDIR /app

RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    libc-dev \
    linux-headers \
    libstdc++ \
    && ln -sf python3 /usr/bin/python

ADD .git /app/.git

ADD package.json lerna.json tsconfig.json tsconfig.esm.json typedoc.js typedoc.decorators.js sync-tsconfig-deps.js install-compiler.sh /app/
ADD .yarnrc.yml yarn.lock /app/
ADD .yarn /app/.yarn

ADD packages/broker /app/packages/broker
ADD packages/ui-library /app/packages/ui-library
ADD packages/desktop-ui /app/packages/desktop-ui
ADD packages/bson /app/packages/bson
ADD packages/core-rxjs /app/packages/core-rxjs
ADD packages/rpc /app/packages/rpc
ADD packages/core /app/packages/core
ADD packages/bench /app/packages/bench
ADD packages/app /app/packages/app
ADD packages/logger /app/packages/logger
ADD packages/stopwatch /app/packages/stopwatch
ADD packages/workflow /app/packages/workflow
ADD packages/injector /app/packages/injector
ADD packages/event /app/packages/event
ADD packages/type /app/packages/type
ADD packages/type-compiler /app/packages/type-compiler
ADD packages/type-spec /app/packages/type-spec
ADD website/package.json /app/website/package.json

RUN node sync-tsconfig-deps.js
RUN --mount=type=cache,target=/root/.yarn YARN_CACHE_FOLDER=/root/.yarn yarn install --inline-builds

ADD website /app/website
RUN npm run build

FROM node:24-alpine3.20
ENV TZ="Europe/Berlin"

EXPOSE 8080
ENV PORT=8080

RUN mkdir /app/

ADD package.json /app/package.json
ADD .yarnrc.yml yarn.lock /app/
ADD .yarn /app/.yarn
ADD packages/ui-library/package.json /app/packages/ui-library/package.json
ADD website/package.json /app/website/package.json
RUN cd /app && yarn workspaces focus website --production

COPY --from=0 /app/website/dist /app/website/dist
COPY --from=0 /app/website/src /app/website/src

ADD website/docker_start.sh /app/website/start.sh

WORKDIR /app/website

CMD sh start.sh
