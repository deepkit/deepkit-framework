# Bench

```typescript
// benchmarks/test.ts
import { benchmark, run } from '@deepkit/bench';

let i = 0;

benchmark('test', () => {
    i += 10;
});

void run();
```

```sh
node --import @deepkit/run benchmarks/test.ts 
```
