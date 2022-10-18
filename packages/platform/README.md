# @deepkit/platform

The purpose of this module is to replace platform-dependent methods with platform-independent methods,
so that Deekit can run on as many runtime bindings as possible in the future, such as [Node.js](https://nodejs.org) (CJS and ESM), [Deno](https://deno.land/), [Gjs](https://gjs.guide/), [Cloudflare Workers](https://workers.cloudflare.com/), [Bun](https://bun.sh/), [Netlify Functions](https://www.netlify.com/products/#netlify-edge-functions) and more.


## State

| Replaces     | Runtime | Type    | Replacement     |
|--------------|---------|---------|-----------------|
| `__dirname`  | Node.js | CJS     | `getDirname()`  |
| `__filename` | Node.js | CJS     | `getFilename()` |

## Installation

On Node.js and GJS you can install the package as with NPM:

```
npm install @deepkit/platform --save
```

On Deno you just need to import this package.

## Usage

Please do not use `getDirname` and `getFilename` in nested other methods, instead always use them in the root of your file, otherwise it may return wrong results.

### Node.js ESM

```js
// node /path/to/the/script.mjs
import { getDirname, getFilename } from '@deepkit/platform'

console.log(getDirname()) // outputs "/path/to/the"
console.log(getFilename()) // outputs "/path/to/the/script.mjs"
```

### Node.js CJS

```js
// node /path/to/the/script.cjs
const { getDirname, getFilename } = require('@deepkit/platform');

console.log(getDirname() === __dirname) // true
console.log(getFilename() === __filename) // true
```

### Deno

```ts
// deno run /path/to/the/script.ts
import { getDirname, getFilename } from 'https://raw.githubusercontent.com/deepkit/deepkit-framework/master/packages/platform/mod.ts';

console.log(getDirname()); // outputs "/path/to/the"
console.log(getFilename()); // outputs "/path/to/the/script.ts"
```

### GJS

You can use NPM packages in GJS you can use a bundler like [esbuild](https://esbuild.github.io/) or import the files directly like this:

```js
// gjs -m path/to/the/script.js
const { getDirname, getFilename } = from './node_modules/@deepkit/platform/dist/esm/index.js';
console.log(getDirname()); // outputs "/path/to/the"
console.log(getFilename()); // outputs "/path/to/the/script.js"
```

### Tests

This module has been tested on the following platforms:

| Runtime | Type   | Platform | State    |
|---------|--------|----------|----------|
| Node.js | CJS    | Linux    | ✔        |
| Node.js | CJS    | MacOS    | ✔        |
| Node.js | CJS    | Windows  | ✔        |
| Node.js | ESM    | Linux    | ✔        |
| Node.js | ESM    | MacOS    | ✔        |
| Node.js | ESM    | Windows  | ✔        |
| Deno    | ESM    | Linux    | ✔        |
| Deno    | ESM    | MacOS    | ✔        |
| Deno    | ESM    | Windows  | ✔        |
| Gjs     | ESM    | Linux    | ✔        |
| Gjs     | ESM    | MacOS    | UNTESTED |
| Gjs     | ESM    | Windows  | UNTESTED |
| Chrome  | ESM    | Browser  | ✔        |
| Chrome  | CJS    | Browser  | ✔        |

You can run all tests with:

```
npm run test
```

Or the tests for a special runtime:

```
npm run test:node
npm run test:deno
npm run test:gjs
npm run test:browser´
```

### Contributions

Contributions for more platforms and other replacement methods are welcome :)
