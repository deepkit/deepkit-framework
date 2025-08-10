# API `@deepkit/run`

```sh
npm install @deepkit/run
```

ビルドステップを必要とせずに TypeScript コードを実行する簡単な方法。

このツールは主に Deepkit 独自のテストスイートでの使用を想定していますが、ご自身のプロジェクトでも使用できます。

```typescript
import { typeOf } from '@deepkit/type';

console.log(typeOf<string>());
```

```sh
node --import @deepkit/run test.ts 
```

<api-docs package="@deepkit/run"></api-docs>