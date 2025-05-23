#!/bin/sh
node dist/app/server/server.mjs migrate
node dist/app/server/server.mjs search:index
node dist/app/server/server.mjs import:questions
node dist/app/server/server.mjs import:examples

app_environment=prod app_framework_port=$PORT node dist/app/server/server.mjs server:start
