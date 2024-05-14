FROM node:20.8.0-alpine3.18
ENV TZ="Europe/Berlin"

RUN mkdir /app/
WORKDIR /app

ADD package.json /app/package.json
ADD .yarnrc.yml yarn.lock /app/
ADD .yarn /app/.yarn
ADD website/package.json /app/website/package.json
RUN yarn workspaces focus website
ADD website/ /app
RUN npm run build

FROM node:20.8.0-alpine3.18
ENV TZ="Europe/Berlin"

EXPOSE 8080
ENV PORT 8080

RUN mkdir /app/
WORKDIR /app

ADD package.json /app/package.json
ADD .yarnrc.yml yarn.lock /app/
ADD .yarn /app/.yarn
ADD website/package.json /app/website/package.json
RUN yarn workspaces focus website --production

COPY --from=0 /app/dist /app/dist
COPY --from=0 /app/src /app/src

ADD website/docker_start.sh /start.sh

CMD sh /start.sh
