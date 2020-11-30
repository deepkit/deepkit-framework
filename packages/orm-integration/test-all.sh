#!/bin/sh

JEST=../node_modules/.bin/jest

ADAPTER_DRIVER=sqlite $JEST --forceExit;
ADAPTER_DRIVER=mongo $JEST --forceExit;
ADAPTER_DRIVER=mysql $JEST --forceExit;
ADAPTER_DRIVER=postgres $JEST --forceExit;
