# 시작하기

Deepkit의 runtime type system을 설치하려면 두 패키지가 필요합니다: Deepkit Type Compiler와 Deepkit Type 패키지 자체. Type compiler는 TypeScript transformer로서 TypeScript types로부터 runtime type information을 생성합니다. type 패키지에는 runtime virtual machine과 type annotations, 그리고 types를 다루기 위한 많은 유용한 함수들이 포함되어 있습니다.


## 설치 

```sh
npm install --save @deepkit/type
npm install --save-dev @deepkit/type-compiler typescript ts-node
```

기본적으로 runtime type information은 생성되지 않습니다. 이를 활성화하려면 `tsconfig.json` 파일에 `"reflection": true`를 설정해야 합니다. 

decorators를 사용하려면 `tsconfig.json`에서 `"experimentalDecorators": true`를 활성화해야 합니다. 이는 `@deepkit/type`을 사용하는 데 엄격히 필요하지는 않지만, 다른 Deepkit 라이브러리의 일부 기능 및 Deepkit Framework에서는 필요합니다.

_파일: tsconfig.json_

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "es6",
    "moduleResolution": "node",
    "experimentalDecorators": true
  },
  "reflection": true
}
```

runtime type information을 사용하는 첫 코드를 작성하세요:

_파일: app.ts_

```typescript
import { cast, MinLength, ReflectionClass } from '@deepkit/type';

interface User {
    username: string & MinLength<3>;
    birthDate?: Date;
}

const user = cast<User>({
    username: 'Peter',
    birthDate: '2010-10-10T00:00:00Z'
});
console.log(user);

const reflection = ReflectionClass.from<User>();
console.log(reflection.getProperty('username').type);
```

그리고 `ts-node`로 실행하세요:

```sh
./node_modules/.bin/ts-node app.ts
```

## 대화형 예제

다음은 codesandbox 예제입니다: https://codesandbox.io/p/sandbox/deepkit-runtime-types-fjmc2f?file=index.ts

## Type compiler

TypeScript 자체는 type compiler를 `tsconfig.json`으로 구성할 수 있도록 지원하지 않습니다. TypeScript compiler API를 직접 사용하거나, Webpack과 같은 build system에서 _ts-loader_를 사용해야 합니다. Deepkit 사용자들이 이러한 번거로움을 겪지 않도록, `@deepkit/type-compiler`가 설치되면 Deepkit type compiler는 자동으로 `node_modules/typescript`에 자신을 설치합니다(NPM install hooks를 통해 수행됩니다).
이에 따라 로컬에 설치된 TypeScript(`node_modules/typescript`에 있는 것)를 참조하는 모든 build tool에서 type compiler가 자동으로 활성화됩니다. 그 결과 _tsc_, Angular, webpack, _ts-node_ 및 일부 다른 도구들이 deepkit type compiler와 자동으로 함께 작동합니다.

type compiler가 자동으로 성공적으로 설치되지 않은 경우(예: NPM install hooks가 비활성화되어 있는 경우), 다음 명령으로 수동으로 설치할 수 있습니다:

```sh
node_modules/.bin/deepkit-type-install
```

로컬 typescript 버전이 업데이트된 경우(예: package.json의 typescript 버전이 변경되고 `npm install`을 실행한 경우), `deepkit-type-install`을 실행해야 한다는 점에 유의하세요.

## Webpack

webpack 빌드에서 type compiler를 사용하려면 `ts-loader` 패키지(또는 transformer 등록을 지원하는 다른 typescript loader)를 사용할 수 있습니다.

_파일: webpack.config.js_

```javascript
const typeCompiler = require('@deepkit/type-compiler');

module.exports = {
  entry: './app.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              //이는 @deepkit/type의 type compiler를 활성화합니다
              getCustomTransformers: (program, getProgram) => ({
                before: [typeCompiler.transformer],
                afterDeclarations: [typeCompiler.declarationTransformer],
              }),
            }
          },
          exclude: /node_modules/,
       },
    ],
  },
}
```