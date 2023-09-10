#!/usr/bin/env sh

set -e;

NODE_ENV=development nx build type-compiler
node dist/packages/type-compiler/install-transformer.cjs.js

#node dist/packages/type-compiler/install-transformer.js packages/api-console-gui;
#node dist/packages/type-compiler/install-transformer.js packages/orm-browser-gui;
#node dist/packages/type-compiler/install-transformer.js packages/framework-debug-gui;
