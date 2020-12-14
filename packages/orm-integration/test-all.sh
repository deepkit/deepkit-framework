#!/bin/sh

JEST="node --no-warnings --experimental-vm-modules ../../node_modules/.bin/jest --no-cache"

echo Integration Test: SQLite
ADAPTER_DRIVER=sqlite $JEST --forceExit;

echo Integration Test: MongoDB
ADAPTER_DRIVER=mongo $JEST --forceExit;

echo Integration Test: MySQL
ADAPTER_DRIVER=mysql $JEST --forceExit;

echo Integration Test: PostgreSQL
ADAPTER_DRIVER=postgres $JEST --forceExit;
