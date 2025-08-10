# 바이트코드

JavaScript에서 Deepkit이 타입 정보를 어떻게 인코딩하고 읽는지 자세히 배우기 위한 장입니다. 타입이 실제로 어떻게 바이트코드로 변환되고, JavaScript로 내보내지며, 런타임에 해석되는지를 설명합니다.

## Typen-Compiler

type compiler(@deepkit/type-compiler)는 TypeScript 파일에 정의된 타입을 읽고 이를 바이트코드로 컴파일하는 역할을 합니다. 이 바이트코드는 런타임에서 타입을 실행하는 데 필요한 모든 것을 포함합니다.
작성 시점 기준으로, type compiler는 소위 TypeScript transformer입니다. 이 transformer는 TypeScript compiler 자체를 위한 plugin이며, TypeScript AST(Abstract Syntax Tree)를 다른 TypeScript AST로 변환합니다. Deepkit의 type compiler는 이 과정에서 AST를 읽고, 해당하는 바이트코드를 생성한 다음 그것을 AST에 삽입합니다.

TypeScript 자체는 tsconfig.json을 통해 이 plugin(= transformer)을 구성할 수 있게 해주지 않습니다. TypeScript compiler API를 직접 사용하거나, Webpack과 ts-loader 같은 build system을 사용해야 합니다. Deepkit 사용자의 불편을 줄이기 위해, Deepkit type compiler는 @deepkit/type-compiler가 설치될 때마다 node_modules/typescript에 스스로를 자동으로 설치합니다. 이에 따라 로컬에 설치된 TypeScript(node_modules/typescript)를 사용하는 모든 build tool에서 type compiler가 자동으로 활성화됩니다. 이로써 tsc, Angular, webpack, ts-node 등 여러 도구가 Deepkit의 type compiler와 자동으로 함께 동작합니다.

만약 NPM install script의 자동 실행이 비활성화되어 로컬에 설치된 TypeScript가 수정되지 않는 경우, 원한다면 이 과정을 수동으로 실행해야 합니다. 또는 webpack과 같은 build tool에서 type compiler를 수동으로 사용할 수도 있습니다. 위의 설치 섹션을 참조하세요.

## 바이트코드 인코딩

바이트코드는 가상 머신을 위한 명령 시퀀스이며, JavaScript 내에서 참조와 문자열(실제 바이트코드)의 배열로 인코딩됩니다.

```typescript
//TypeScript
type TypeA = string;

//생성된 JavaScript
const typeA = ['&'];
```

기존 명령들은 각각 1바이트 크기이며, `@deepkit/type-spec`의 `ReflectionOp` enum에서 확인할 수 있습니다. 작성 시점 기준으로 명령 집합은 81개 이상의 명령으로 구성됩니다.

```typescript
enum ReflectionOp {
    never,
    any,
    unknown,
    void,
    object,

    string,
    number,

    //...그 외 다수
}
```

명령 시퀀스는 메모리를 절약하기 위해 문자열로 인코딩됩니다. 따라서 타입 `string[]`은 바이트코드 프로그램 `[string, array]`로 개념화되며, 바이트 `[5, 37]`을 갖고 다음 알고리즘으로 인코딩됩니다:

```typescript
function encodeOps(ops: ReflectionOp[]): string {
    return ops.map(v => String.fromCharCode(v + 33)).join('');
}
```

이에 따라 5는 문자 '&'가 되고 37은 문자 'F'가 됩니다. 함께 하면 '&F'가 되며 JavaScript에서는 `['&F']`로 출력됩니다.

```typescript
//TypeScript
export type TypeA = string[];

//생성된 JavaScript
export const __ΩtypeA = ['&F'];
```

이름 충돌을 방지하기 위해 각 타입에는 '_Ω' 접두사가 부여됩니다. export되었거나 export된 타입에서 사용되는 명시적으로 정의된 각 타입에 대해 JavaScript로 바이트코드가 내보내집니다. Class와 Function 또한 속성으로 직접 바이트코드를 가집니다.

```typescript
//TypeScript
function log(message: string): void {}

//생성된 JavaScript
function log(message) {}
log.__type = ['message', 'log', 'P&2!$/"'];
```

## 가상 머신

런타임에는 가상 머신(`@deepkit/type`의 class Processor)이 인코딩된 바이트코드를 디코딩하고 실행하는 책임을 집니다. 이는 [리플렉션 API](./reflection.md)에 설명된 대로 항상 type object를 반환합니다.

더 많은 정보는 [TypeScript 바이트코드 인터프리터 / 런타임 타입 #47658](https://github.com/microsoft/TypeScript/issues/47658)에서 확인할 수 있습니다.