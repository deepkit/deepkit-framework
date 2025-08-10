# Benutzerdefinierter Serializer

Standardmäßig enthält `@deepkit/type` einen JSON-Serializer und Typvalidierung für TypeScript-Typen. Sie können dies erweitern und die Serialisierungsfunktionalität hinzufügen oder entfernen oder ändern, wie die Validierung durchgeführt wird, da die Validierung ebenfalls mit dem Serializer verknüpft ist.

## Neuer Serializer

Ein Serializer ist einfach eine Instanz der Klasse `Serializer` mit registrierten Serializer-Templates. Serializer-Templates sind kleine Funktionen, die JavaScript-Code für den JIT-Serializer-Prozess erzeugen. Für jeden Typ (String, Number, Boolean usw.) gibt es ein separates Serializer-Template, das dafür verantwortlich ist, Code für die Datenkonvertierung oder Validierung zurückzugeben. Dieser Code muss mit der JavaScript-Engine kompatibel sein, die der Benutzer verwendet.

Nur während der Ausführung der Compiler-Template-Funktion haben (oder sollten) Sie vollen Zugriff auf den vollständigen Typ. Die Idee ist, dass Sie alle Informationen, die zur Umwandlung eines Typs benötigt werden, direkt in den JavaScript-Code einbetten, was zu hochoptimiertem Code führt (auch JIT-optimierter Code genannt).

Das folgende Beispiel erstellt einen leeren Serializer.

```typescript
import { EmptySerializer } from '@deepkit/type';

class User {
    name: string = '';
    created: Date = new Date;
}

const mySerializer = new EmptySerializer('mySerializer');

const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
console.log(user);
```

```sh
$ ts-node app.ts
User { name: 'Peter', created: 0 }
```

Wie Sie sehen, wurde nichts konvertiert (`created` ist immer noch eine Zahl, obwohl wir es als `Date` definiert haben). Um dies zu ändern, fügen wir ein Serializer-Template für die Deserialisierung des Typs Date hinzu.

```typescript
mySerializer.deserializeRegistry.registerClass(Date, (type, state) => {
    state.addSetter(`new Date(${state.accessor})`);
});

const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
console.log(user);
```

```sh
$ ts-node app.ts
User { name: 'Peter', created: 2021-06-10T19:34:27.301Z }
```

Jetzt konvertiert unser Serializer den Wert in ein Date-Objekt.

Um dasselbe für die Serialisierung zu tun, registrieren wir ein weiteres Serialisierungs-Template.

```typescript
mySerializer.serializeRegistry.registerClass(Date, (type, state) => {
    state.addSetter(`${state.accessor}.toJSON()`);
});

const user1 = new User();
user1.name = 'Peter';
user1.created = new Date('2021-06-10T19:34:27.301Z');
console.log(serialize(user1, undefined, mySerializer));
```

```sh
{ name: 'Peter', created: '2021-06-10T19:34:27.301Z' }
```

Unser neuer Serializer konvertiert das Datum im Serialisierungsprozess nun korrekt vom Date-Objekt in einen String.

## Beispiele

Viele weitere Beispiele finden Sie im Code der in Deepkit Type enthaltenen [JSON-Serializer](https://github.com/deepkit/deepkit-framework/blob/master/packages/type/src/serializer.ts#L1688).

## Vorhandenen Serializer erweitern

Wenn Sie einen vorhandenen Serializer erweitern möchten, können Sie dies mittels Klassenvererbung tun. Das funktioniert, weil Serializer so geschrieben sein sollten, dass sie ihre Templates im Konstruktor registrieren.

```typescript
class MySerializer extends Serializer {
    constructor(name: string = 'mySerializer') {
        super(name);
        this.registerTemplates();
    }

    protected registerTemplates() {
        this.deserializeRegistry.register(ReflectionKind.string, (type, state) => {
            state.addSetter(`String(${state.accessor})`);
        });

        this.deserializeRegistry.registerClass(Date, (type, state) => {
            state.addSetter(`new Date(${state.accessor})`);
        });

        this.serializeRegistry.registerClass(Date, (type, state) => {
            state.addSetter(`${state.accessor}.toJSON()`);
        });
    }
}
const mySerializer = new MySerializer();
```