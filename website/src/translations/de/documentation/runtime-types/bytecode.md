# Bytecode

Dieses Kapitel erläutert im Detail, wie Deepkit die Typinformationen in JavaScript kodiert und ausliest. Es erklärt, wie die Typen tatsächlich in Bytecode umgewandelt, in JavaScript emittiert und zur Laufzeit interpretiert werden.

## Typen-Compiler

Der Typen-Compiler (in @deepkit/type-compiler) ist dafür verantwortlich, die definierten Typen in den TypeScript-Dateien einzulesen und in einen Bytecode zu kompilieren. Dieser Bytecode enthält alles Nötige, um die Typen zur Laufzeit auszuführen.
Zum Zeitpunkt der Erstellung dieses Textes ist der Typen-Compiler ein sogenannter TypeScript-Transformer. Dieser Transformer ist ein Plugin für den TypeScript-Compiler selbst und konvertiert einen TypeScript-AST (Abstract Syntax Tree) in einen anderen TypeScript-AST. Deepkits Typen-Compiler liest dabei den AST, erzeugt den entsprechenden Bytecode und fügt ihn in den AST ein.

TypeScript selbst erlaubt es nicht, dieses Plugin aka Transformer über eine tsconfig.json zu konfigurieren. Entweder muss die TypeScript-Compiler-API direkt verwendet werden oder ein Build-System wie Webpack mit `ts-loader`. Um Deepkit-Nutzern diesen umständlichen Weg zu ersparen, installiert sich der Deepkit-Typen-Compiler automatisch in `node_modules/typescript`, sobald `@deepkit/type-compiler` installiert wird. Dadurch ist es für alle Build-Tools, die auf das lokal installierte TypeScript zugreifen (das in `node_modules/typescript`), möglich, den Typen-Compiler automatisch aktiviert zu haben. So funktionieren tsc, Angular, webpack, ts-node und einige andere Tools automatisch mit Deepkits Typen-Compiler.

Wenn das automatische Ausführen von NPM-Installationsskripten nicht aktiviert ist und somit das lokal installierte TypeScript nicht angepasst wird, muss dieser Prozess bei Bedarf manuell ausgeführt werden. Alternativ kann der Typen-Compiler manuell in einem Build-Tool wie webpack verwendet werden. Siehe den Installationsabschnitt oben.

## Bytecode-Encoding

Der Bytecode ist eine Sequenz von Befehlen für eine virtuelle Maschine und wird im JavaScript selbst als Array aus Referenzen und String (dem eigentlichen Bytecode) kodiert.

```typescript
//TypeScript
type TypeA = string;

//generiertes JavaScript
const typeA = ['&'];
```

Die vorhandenen Befehle selbst sind jeweils ein Byte groß und finden sich in `@deepkit/type-spec` als `ReflectionOp`-Enums. Zum Zeitpunkt der Erstellung dieses Textes umfasst der Befehlssatz über 81 Befehle.

```typescript
enum ReflectionOp {
    never,
    any,
    unknown,
    void,
    object,

    string,
    number,

    // ...viele weitere
}
```

Eine Befehlssequenz wird zur Speicherersparnis als String kodiert. Ein Typ `string[]` wird dabei als Bytecode-Programm `[string, array]` konzeptualisiert, das die Bytes `[5, 37]` hat und mit folgendem Algorithmus kodiert wird:

```typescript
function encodeOps(ops: ReflectionOp[]): string {
    return ops.map(v => String.fromCharCode(v + 33)).join('');
}
```

Dementsprechend wird eine 5 zum Zeichen `&` und eine 37 zum Zeichen `F`. Zusammen ergeben sie `&F` und werden in JavaScript als `['&F']` emittiert.

```typescript
//TypeScript
export type TypeA = string[];

//generiertes JavaScript
export const __ΩtypeA = ['&F'];
```

Um Namenskonflikte zu vermeiden, erhält jeder Typ ein Präfix „_Ω“. Für jeden explizit definierten Typ, der exportiert wird oder von einem exportierten Typ verwendet wird, wird im JavaScript ein Bytecode emittiert. Auch Klassen und Functions erhalten ebenfalls direkt eine Bytecode-Property.

```typescript
//TypeScript
function log(message: string): void {}

//generiertes JavaScript
function log(message) {}
log.__type = ['message', 'log', 'P&2!$/"'];
```

## Virtuelle Maschine

Eine virtuelle Maschine (in `@deepkit/type` die Class Processor) ist zur Laufzeit für das Dekodieren und Ausführen des kodierten Bytecodes verantwortlich. Sie gibt stets ein Type-Objekt zurück, wie in der [Reflection-API](./reflection.md) beschrieben.

Weitere Informationen finden sich in [TypeScript Bytecode Interpreter / Runtime Types #47658](https://github.com/microsoft/TypeScript/issues/47658)