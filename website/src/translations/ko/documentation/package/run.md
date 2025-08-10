# API `@deepkit/run`

```sh
npm install @deepkit/run
```

빌드 단계가 필요 없이 TypeScript 코드를 실행하는 간단한 방법입니다.

이 도구는 주로 Deepkit의 자체 테스트 스위트에서 사용하도록 설계되었지만, 여러분의 프로젝트에서도 사용할 수 있습니다.

```typescript
import { typeOf } from '@deepkit/type';

console.log(typeOf<string>());
```

```sh
node --import @deepkit/run test.ts 
```

<api-docs package="@deepkit/run"></api-docs>