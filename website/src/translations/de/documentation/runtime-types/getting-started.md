# Erste Schritte

Um Deepkits Runtime Type System zu installieren, werden zwei Packages benötigt: der Deepkit Type Compiler und das Deepkit Type Package selbst. Der Type Compiler ist ein TypeScript Transformer, der Runtime Type Information aus TypeScript Types generiert. Das Type Package enthält die Runtime Virtual Machine und Type Annotations sowie viele nützliche Funktionen für die Arbeit mit Types.


## Installation 

```sh
npm install --save @deepkit/type
npm install --save-dev @deepkit/type-compiler typescript ts-node
```

Runtime Type Information wird nicht standardmäßig generiert. Dazu muss `"reflection": true` in der Datei `tsconfig.json` gesetzt werden, um sie zu aktivieren. 

Wenn Decorators verwendet werden sollen, muss `"experimentalDecorators": true` in `tsconfig.json` aktiviert sein. Das ist nicht zwingend erforderlich, um mit `@deepkit/type` zu arbeiten, aber für bestimmte Funktionen anderer Deepkit Libraries und im Deepkit Framework notwendig.

_Datei: tsconfig.json_

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

Schreiben Sie Ihren ersten Code mit Runtime Type Information:

_Datei: app.ts_

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

Und führen Sie es mit `ts-node` aus:

```sh
./node_modules/.bin/ts-node app.ts
```

## Interaktives Beispiel

Hier ist ein CodeSandbox-Beispiel: https://codesandbox.io/p/sandbox/deepkit-runtime-types-fjmc2f?file=index.ts

## Type Compiler

TypeScript selbst erlaubt es nicht, den Type Compiler über eine `tsconfig.json` zu konfigurieren. Dazu muss entweder die TypeScript Compiler API direkt verwendet werden oder ein Build-System wie Webpack mit _ts-loader_. Um Deepkit-Nutzern diesen umständlichen Weg zu ersparen, installiert sich der Deepkit Type Compiler automatisch in `node_modules/typescript`, sobald `@deepkit/type-compiler` installiert ist (dies geschieht über NPM Install Hooks).
Dadurch haben alle Build-Tools, die auf das lokal installierte TypeScript (das in `node_modules/typescript`) zugreifen, den Type Compiler automatisch aktiviert. So funktionieren _tsc_, Angular, webpack, _ts-node_ und einige andere Tools automatisch mit dem Deepkit Type Compiler.

Falls der Type Compiler nicht automatisch erfolgreich installiert werden konnte (z. B. weil NPM Install Hooks deaktiviert sind), kann dies manuell mit folgendem Befehl erfolgen:

```sh
node_modules/.bin/deepkit-type-install
```

Beachten Sie, dass `deepkit-type-install` ausgeführt werden muss, wenn die lokale typescript-Version aktualisiert wurde (z. B. wenn sich die typescript-Version in package.json geändert hat und `npm install` ausgeführt wird).

## Webpack

Wenn Sie den Type Compiler in einem webpack-Build verwenden möchten, können Sie dies mit dem `ts-loader` Package tun (oder mit einem anderen TypeScript Loader, der Transformer Registration unterstützt).

_Datei: webpack.config.js_

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
              //aktiviert den Type Compiler von @deepkit/type
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