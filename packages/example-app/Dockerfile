FROM node:16-alpine

RUN apk --no-cache add g++ gcc git libgcc libstdc++ linux-headers make python3 libexecinfo-dev

WORKDIR /app

# first package manager stuff so installing is cached by Docker.
ADD package.json /app/package.json
ADD package-lock.json /app/package-lock.json
RUN npm install

ADD . /app

RUN ./node_modules/.bin/tsc

RUN npm prune --production

FROM node:16-alpine

WORKDIR /app

COPY --from=0 /app /app

ENV APP_kernel_host=0.0.0.0
EXPOSE 8080

CMD node dist/app.js server:start
