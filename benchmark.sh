#!/bin/sh

export SEND_TO=http://deepkit.io/benchmark/add
#export AUTH_TOKEN=PLEASE_SET

cd packages/benchmark;

nice -20 npm run benchmark orm/end-to-end/ bson/parse bson/serialiser type/serialization/small type/validation
