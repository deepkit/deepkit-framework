FROM node:20.8.0-alpine3.18
ENV TZ="Europe/Berlin"

RUN mkdir /app/
WORKDIR /app

ADD package.json /app/package.json
ADD package-lock.json /app/package-lock.json
RUN npm ci
ADD . /app
RUN npm run build

FROM node:20.8.0-alpine3.18
ENV TZ="Europe/Berlin"

EXPOSE 8080
ENV PORT 8080

RUN mkdir /app/
WORKDIR /app

ADD package.json /app/package.json
ADD package-lock.json /app/package-lock.json
RUN npm ci --production

COPY --from=0 /app/dist /app/dist
COPY --from=0 /app/src /app/src

ADD docker_start.sh /start.sh

CMD sh /start.sh
