# estdlib.ts

[![Build Status](https://travis-ci.com/marcj/estdlib.ts.svg?branch=master)](https://travis-ci.com/marcj/estdlib.ts)
[![npm version](https://badge.fury.io/js/%40marcj%2Festdlib.svg)](https://badge.fury.io/js/%40marcj%2Festdlib)

### Installation

```
npm install @deepkit/core
```


### Usage example

```typescript
import {each} from "@deepkit/core";

for (const item of each({a: 1, b: 2, c: 3})) {
    console.log(item)
}
```
