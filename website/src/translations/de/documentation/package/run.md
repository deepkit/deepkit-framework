# API `@deepkit/run`

```sh
npm install @deepkit/run
```

Eine einfache Möglichkeit, TypeScript-Code ohne einen Build-Schritt auszuführen.

Dieses Tool ist primär für den Einsatz in Deepkits eigener Test-Suite gedacht, kann jedoch auch in eigenen Projekten verwendet werden.

```typescript
import { typeOf } from '@deepkit/type';

console.log(typeOf<string>());
```

```sh
node --import @deepkit/run test.ts 
```

<api-docs package="@deepkit/run"></api-docs>