#!/bin/sh

git checkout .
git fetch origin master
git checkout origin/master

npm ci
npm run bootstrap:ci
npm run link
npm run clean
npm run install-compiler

./node_modules/.bin/tsc --build tsconfig.json

export SEND_TO=http://deepkit.io/benchmark/add
#export AUTH_TOKEN=PLEASE_SET

cd packages/benchmark;

node node_modules/@deepkit/type-compiler/dist/cjs/install-transformer.js

docker rm -f bench-mongo
docker run -d --rm --name bench-mongo -d -p 127.0.0.1:27017:27017 mongo:4.2

docker rm -f bench-mysql
docker run -d --rm --name bench-mysql -d -e MYSQL_DATABASE=default -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 127.0.0.1:3306:3306 mysql:8

docker rm -f bench-postgres
docker run -d --rm --name bench-postgres -d -e POSTGRES_PASSWORD=password -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:5432:5432 postgres:13.4

nice -20 npm run benchmark orm/end-to-end/ bson/parse bson/serializer type/serialization/small type/validation > /tmp/benchmark.log
