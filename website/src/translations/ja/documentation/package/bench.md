# API `@deepkit/bench`

```sh
npm install @deepkit/bench
```

コードスニペットをベンチマークするためのシンプルなツール。

```typescript
import { benchmark, run } from '@deepkit/bench';

// ASCII バイナリパースの例
const binaryString = Buffer.from('Hello World', 'utf8');
const codes = [

benchmark('Buffer.toString', () => {
    const utf8String = binaryString.toString('utf8');
});

benchmark('String.fromCodePoint', () => {
    const utf8String = String.fromCodePoint()
});

void run();
```

```sh
$ node --import @deepkit/run benchmarks/ascii-parsing.ts
Node v22.13.1
 🏎 x  20,326,482.53 ops/sec ± 4.95%   0.000049 ms/op 	▆▆▇▅▆▆▅▅▆▅▅▅▅▅▅▅▅▅▅▅▅▅ Buffer.toString 	19850001 samples
 🏎 x  36,012,545.69 ops/sec ± 1.78%   0.000028 ms/op 	▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇ String.fromCodePoint 	35800001 samples
done
```

<api-docs package="@deepkit/bench"></api-docs>