FROM node:24-alpine3.20
ENV TZ="Europe/Berlin"

RUN mkdir /app/
WORKDIR /app

ADD package.json /app/package.json
ADD .yarnrc.yml yarn.lock /app/
ADD .yarn /app/.yarn
ADD website/package.json /app/website/package.json
RUN yarn workspaces focus website
ADD website /app/website
RUN cd website && npm run build

FROM node:24-alpine3.20
ENV TZ="Europe/Berlin"

EXPOSE 8080
ENV PORT=8080

RUN mkdir /app/

ADD package.json /app/package.json
ADD .yarnrc.yml yarn.lock /app/
ADD .yarn /app/.yarn
ADD website/package.json /app/website/package.json
RUN cd /app && yarn workspaces focus website --production

COPY --from=0 /app/website/dist /app/website/dist
COPY --from=0 /app/website/src /app/website/src

ADD website/docker_start.sh /app/website/start.sh

WORKDIR /app/website

CMD sh start.sh
