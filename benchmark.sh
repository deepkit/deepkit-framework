#!/bin/sh

export SEND_TO=http://deepkit.io/benchmark/add
#export AUTH_TOKEN=PLEASE_SET

cd packages/benchmark;

docker run --rm --name bench-mongo -d -p 127.0.0.1:27017:27017 mongo:4.2
docker run --rm --name bench-mysql -d -e MYSQL_DATABASE=default -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 127.0.0.1:3306:3306 mysql:8
docker run --rm --name bench-postgres -d -e POSTGRES_PASSWORD=password -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:5432:5432 postgres:13.4

nice -20 npm run benchmark orm/end-to-end/ bson/parse bson/serializer type/serialization/small type/validation
