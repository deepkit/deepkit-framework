# API `@deepkit/run`

```sh
npm install @deepkit/run
```

A simple way to run TypeScript code without the need for a build step.

This tool is primarily meant to be used in Deepkit's own test suite, but can also be used in your own projects.

```typescript
import { typeOf } from '@deepkit/type';

console.log(typeOf<string>());
```

```sh
node --import @deepkit/run test.ts 
```

<api-docs package="@deepkit/run"></api-docs>
