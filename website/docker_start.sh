#!/bin/sh
node dist/src/server/app.js migrate
node dist/src/server/app.js search:index
node dist/src/server/app.js import:questions
node dist/src/server/app.js import:examples

app_environment=prod app_framework_port=$PORT node dist/src/server/app.js server:start
