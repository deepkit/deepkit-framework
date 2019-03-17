FROM node:alpine

RUN npm config set unsafe-perm true
RUN npm i -g lerna
RUN apk --no-cache add git

ADD . /lib
RUN cd /lib && npm run bootstrap && npm run docs

FROM nginx:alpine

ENV PORT=8080

COPY --from=0 /lib/docs /usr/share/nginx/html

RUN echo "gzip on; \
          gzip_buffers 16 8k; \
          gzip_comp_level 1; \
          gzip_http_version 1.1; \
          gzip_min_length 10; \
          gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/x-icon application/vnd.ms-fontobject font/opentype application/x-font-ttf; \
          gzip_vary on; \
          gzip_proxied any; # Compression for all requests. \
          ## No need for regexps. See \
          ## http://wiki.nginx.org/NginxHttpGzipModule#gzip_disable \
          gzip_disable msie6;" > /etc/nginx/conf.d/gzip.conf

CMD sed -i -e "s/listen       80/listen       $PORT/g" /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'
