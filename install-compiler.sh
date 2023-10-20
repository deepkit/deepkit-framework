#!/usr/bin/env sh

set -e;

tsc --build packages/type-compiler/tsconfig.json;
node packages/type-compiler/dist/cjs/install-transformer.js;


node packages/type-compiler/dist/cjs/install-transformer.js packages/desktop-ui;
node packages/type-compiler/dist/cjs/install-transformer.js packages/api-console-gui;
node packages/type-compiler/dist/cjs/install-transformer.js packages/orm-browser-gui;
node packages/type-compiler/dist/cjs/install-transformer.js packages/framework-debug-gui;
