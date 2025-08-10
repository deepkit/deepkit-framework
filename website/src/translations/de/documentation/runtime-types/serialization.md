# Serialisierung

Serialisierung ist der Prozess, Datentypen in ein Format zu überführen, das z. B. für Transport oder Speicherung geeignet ist. Deserialisierung ist der Prozess, dies rückgängig zu machen. Dies geschieht verlustfrei, das bedeutet, dass Daten zu und von einem Serialisierungsziel konvertiert werden können, ohne Typinformationen oder die Daten selbst zu verlieren.

In JavaScript erfolgt Serialisierung üblicherweise zwischen JavaScript-Objekten und JSON. JSON unterstützt nur String, Number, Boolean, Objects und Arrays. JavaScript hingegen unterstützt viele weitere Typen wie BigInt, ArrayBuffer, typed arrays, Date, benutzerdefinierte Class-Instanzen und viele mehr. Um JavaScript-Daten per JSON an einen Server zu übertragen, benötigen Sie also einen Serialisierungsprozess (auf dem Client) und einen Deserialisierungsprozess (auf dem Server), oder umgekehrt, wenn der Server Daten als JSON an den Client sendet. `JSON.parse` und `JSON.stringify` zu verwenden, reicht dafür oft nicht aus, da dies nicht verlustfrei ist.

Dieser Serialisierungsprozess ist für nicht-triviale Daten unbedingt erforderlich, da JSON seine Informationen selbst bei grundlegenden Typen wie einem Datum verliert. Ein neues Date wird letztlich als String in JSON serialisiert:

```typescript
const json = JSON.stringify(new Date);
//'"2022-05-13T20:48:51.025Z"
```

Wie Sie sehen, ist das Ergebnis von JSON.stringify ein JSON-String. Wenn Sie es erneut mit JSON.parse deserialisieren, erhalten Sie kein Date-Objekt, sondern einen String.

```typescript
const value = JSON.parse('"2022-05-13T20:48:51.025Z"');
//"2022-05-13T20:48:51.025Z"
```

Obwohl es verschiedene Workarounds gibt, um JSON.parse beizubringen, Date-Objekte zu deserialisieren, sind sie fehleranfällig und leistungsschwach. Um typsichere Serialisierung und Deserialisierung für diesen Fall und viele andere Types zu ermöglichen, ist ein Serialisierungsprozess notwendig.

Es stehen vier Hauptfunktionen zur Verfügung: `serialize`, `cast`, `deserialize` und `validatedDeserialize`. Unter der Haube dieser Funktionen wird standardmäßig der global verfügbare JSON-Serializer aus `@deepkit/type` verwendet, es kann aber auch ein benutzerdefiniertes Serialisierungsziel verwendet werden.

Deepkit Type unterstützt benutzerdefinierte Serialisierungsziele, bringt jedoch bereits ein leistungsstarkes JSON-Serialisierungsziel mit, das Daten als JSON-Objekte serialisiert und dann mittels JSON.stringify korrekt und sicher in JSON umgewandelt werden kann. Mit `@deepkit/bson` kann auch BSON als Serialisierungsziel verwendet werden. Wie man ein benutzerdefiniertes Serialisierungsziel erstellt (z. B. für einen Datenbanktreiber), erfahren Sie im Abschnitt Custom Serializer.

Beachten Sie, dass Serializer zwar auch Daten auf Kompatibilität validieren, diese Validierungen jedoch von der Validierung in [Validierung](validation.md) abweichen. Nur die Funktion `cast` ruft nach erfolgreicher Deserialisierung auch den vollständigen Validierungsprozess aus dem Kapitel [Validierung](validation.md) auf und wirft einen Fehler, wenn die Daten nicht gültig sind.

Alternativ kann `validatedDeserialize` verwendet werden, um nach der Deserialisierung zu validieren. Eine weitere Alternative ist, die Funktionen `validate` oder `validates` manuell auf deserialisierte Daten aus der Funktion `deserialize` aufzurufen, siehe [Validierung](validation.md).

Alle Funktionen aus Serialisierung und Validierung werfen bei Fehlern einen `ValidationError` aus `@deepkit/type`.

## Cast

Die Funktion `cast` erwartet als erstes Type-Argument einen TypeScript Type und als zweites Argument die zu konvertierenden Daten. Die Daten werden in den angegebenen Type gecastet und bei Erfolg zurückgegeben. Wenn die Daten mit dem angegebenen Type nicht kompatibel sind und nicht automatisch konvertiert werden können, wird ein `ValidationError` geworfen.

```typescript
import { cast } from '@deepkit/type';

cast<string>(123); //'123'
cast<number>('123'); //123
cast<number>('asdasd'); // wirft ValidationError

cast<string | number>(123); //123
```

```typescript
class MyModel {
    id: number = 0;
    created: Date = new Date;

    constructor(public name: string) {
    }
}

const myModel = cast<MyModel>({
    id: 5,
    created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
    name: 'Peter',
});
```

Die Funktion `deserialize` ist `cast` ähnlich, wirft jedoch keinen Fehler, wenn die Daten mit dem angegebenen Type nicht kompatibel sind. Stattdessen werden die Daten so weit wie möglich konvertiert und das Ergebnis zurückgegeben. Wenn die Daten nicht kompatibel sind, werden sie unverändert zurückgegeben.

## Serialisierung

```typescript
import { serialize } from '@deepkit/type';

class MyModel {
    id: number = 0;
    created: Date = new Date;

    constructor(public name: string) {
    }
}

const model = new MyModel('Peter');

const jsonObject = serialize<MyModel>(model);
//{
//  id: 0,
//  created: '2021-06-10T15:07:24.292Z',
//  name: 'Peter'
//}
const json = JSON.stringify(jsonObject);
```

Die Funktion `serialize` konvertiert die übergebenen Daten standardmäßig mit dem JSON-Serializer in ein JSON-Objekt, also: String, Number, Boolean, Object oder Array. Das Ergebnis kann anschließend sicher mit `JSON.stringify` zu JSON konvertiert werden.

## Deserialisierung

Die Funktion `deserialize` konvertiert die übergebenen Daten standardmäßig mit dem JSON-Serializer in die entsprechenden angegebenen Types. Der JSON-Serializer erwartet ein JSON-Objekt, d. h.: string, number, boolean, object oder array. Dieses erhält man üblicherweise aus einem `JSON.parse`-Aufruf.

```typescript
import { deserialize } from '@deepkit/type';

class MyModel {
    id: number = 0;
    created: Date = new Date;

    constructor(public name: string) {
    }
}

const myModel = deserialize<MyModel>({
    id: 5,
    created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
    name: 'Peter',
});

//aus JSON
const json = '{"id": 5, "created": "Sat Oct 13 2018 14:17:35 GMT+0200", "name": "Peter"}';
const myModel = deserialize<MyModel>(JSON.parse(json));
```

Wenn bereits der korrekte Datentyp übergeben wird (z. B. ein Date-Objekt im Fall von `created`), dann wird dieses unverändert übernommen.

Es kann nicht nur eine Class, sondern jeder TypeScript Type als erstes Type-Argument angegeben werden. Somit können auch Primitive Types oder sehr komplexe Types übergeben werden:

```typescript
deserialize<Date>('Sat Oct 13 2018 14:17:35 GMT+0200');
deserialize<string | number>(23);
```

<a name="loosely-convertion"></a>
### Lockere Typkonvertierung

Im Deserialisierungsprozess ist eine lockere Typkonvertierung implementiert. Das bedeutet, dass String und Number für entsprechende Types akzeptiert und automatisch konvertiert werden können, z. B. eine Number für einen String Type oder umgekehrt. Das ist z. B. nützlich, wenn Daten über eine URL angenommen und an den Deserializer übergeben werden. Da die URL immer ein String ist, versucht Deepkit Type dennoch, die Types für Number und Boolean aufzulösen.

```typescript
deserialize<boolean>('false')); //false
deserialize<boolean>('0')); //false
deserialize<boolean>('1')); //true

deserialize<number>('1')); //1

deserialize<string>(1)); //'1'
```

Die folgenden lockeren Typkonvertierungen sind im JSON-Serializer eingebaut:

* number|bigint: Number oder BigInt akzeptieren String, Number und BigInt. `parseFloat` bzw. `BigInt(x)` werden bei einer notwendigen Konvertierung verwendet.
* boolean: Boolean akzeptiert Number und String. 0, '0', 'false' wird als `false` interpretiert. 1, '1', 'true' wird als `true` interpretiert.
* string: String akzeptiert Number, String, Boolean und vieles mehr. Alle Nicht-String-Werte werden automatisch mit `String(x)` konvertiert.

Die lockere Konvertierung kann auch deaktiviert werden:

```typescript
const result = deserialize(data, {loosely: false});
```

Bei ungültigen Daten wird nicht versucht, diese zu konvertieren, stattdessen wird ein Fehler ausgelöst.