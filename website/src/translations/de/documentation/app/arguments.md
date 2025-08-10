# Argumente & Flags

Befehlsargumente im Terminal Ihres Befehls sind einfach normale Argumente der `execute`-Methode oder der Funktion. Sie werden automatisch den Kommandozeilenargumenten zugeordnet.
Wenn Sie einen Parameter als optional markieren, muss er nicht übergeben werden. Wenn Sie einen Standardwert haben, muss er ebenfalls nicht übergeben werden.

Je nach Typ (string, number, union, etc.) wird der übergebene Wert automatisch deserialisiert und validiert.

```typescript
import { cli } from '@deepkit/app';

//funktional
new App().command('test', (name: string) => {
    console.log('Hello', name);
});

//Klasse
@cli.controller('test')
class TestCommand {
    async execute(name: string) {
        console.log('Hello', name);
    }
}
```

Wenn Sie diesen Befehl jetzt ohne Angabe des Parameters name ausführen, wird ein Fehler ausgegeben:

```sh
$ ts-node app.ts test
RequiredArgsError: Missing 1 required arg:
name
```

Mit `--help` erhalten Sie mehr Informationen über die erforderlichen Argumente:

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node-script app.ts test NAME
```

Sobald der Name als Argument übergeben wird, wird der Befehl ausgeführt und der Name korrekt übergeben.

```sh
$ ts-node app.ts test "beautiful world"
Hello beautiful world
```

Jeder primitive Parametertyp wie string, number, boolean, String-Literale, deren Union sowie Arrays davon werden automatisch als CLI-Argumente verwendet
und automatisch validiert und deserialisiert. Die Reihenfolge der Parameter bestimmt die Reihenfolge der CLI-Argumente. Sie können so viele Parameter hinzufügen, wie Sie möchten.

Sobald ein komplexes Objekt (Interface, Klasse, Objektliteral) definiert ist, wird es als Service-Abhängigkeit behandelt
und der Dependency Injection Container versucht, es aufzulösen. Siehe das Kapitel [Abhängigkeitsinjektion](dependency-injection.md) für mehr Informationen.

## Flags

Flags sind eine weitere Möglichkeit, Werte an Ihren Befehl zu übergeben. Meistens sind sie optional, müssen es aber nicht sein. Mit dem `Flag`-Typ markierte Parameter können via `--name value` oder `--name=value` übergeben werden.

```typescript
import { Flag } from '@deepkit/app';

//funktional
new App().command('test', (id: number & Flag) => {
    console.log('id', name);
});

//Klasse
class TestCommand {
    async execute(id: number & Flag) {
        console.log('id', id);
    }
}
```

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test

OPTIONS
  --id=id  (required)
```

In der Hilfe sehen Sie unter „OPTIONS“, dass ein `--id`-Flag erforderlich ist. Wenn Sie dieses Flag korrekt angeben, erhält der Befehl diesen Wert.

```sh
$ ts-node app.ts test --id 23
id 23

$ ts-node app.ts test --id=23
id 23
```

### Boolesche Flags

Flags haben den Vorteil, dass sie auch ohne Wert verwendet werden können, z. B. um ein bestimmtes Verhalten zu aktivieren. Sobald ein Parameter als optionaler Boolean markiert ist, wird dieses Verhalten aktiviert.

```typescript
import { Flag } from '@deepkit/app';

//funktional
new App().command('test', (remove: boolean & Flag = false) => {
    console.log('delete?', remove);
});

//Klasse
class TestCommand {
    async execute(remove: boolean & Flag = false) {
        console.log('delete?', remove);
    }
}
```

```sh
$ ts-node app.ts test
delete? false

$ ts-node app.ts test --remove
delete? true
```

### Mehrfach-Flags

Um mehrere Werte an dasselbe Flag zu übergeben, kann ein Flag als Array markiert werden.

```typescript
import { Flag } from '@deepkit/app';

//funktional
new App().command('test', (id: number[] & Flag = []) => {
    console.log('ids', id);
});

//Klasse
class TestCommand {
    async execute(id: number[] & Flag = []) {
        console.log('ids', id);
    }
}
```

```sh
$ ts-node app.ts test
ids: []

$ ts-node app.ts test --id 12
ids: [12]

$ ts-node app.ts test --id 12 --id 23
ids: [12, 23]
```

### Einzelzeichen-Flags

Um ein Flag auch als einzelnes Zeichen zuzulassen, kann `Flag<{char: 'x'}>` verwendet werden.

```typescript
import { Flag } from '@deepkit/app';

//funktional
new App().command('test', (output: string & Flag<{char: 'o'}>) => {
    console.log('output: ', output);
});

//Klasse
class TestCommand {
    async execute(output: string & Flag<{char: 'o'}>) {
        console.log('output: ', output);
    }
}
```

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test

OPTIONS
  -o, --output=output  (required)


$ ts-node app.ts test --output test.txt
output: test.txt

$ ts-node app.ts test -o test.txt
output: test.txt
```

## Optional / Standardwert

Die Signatur der Methode/Funktion definiert, welche Argumente oder Flags optional sind. Ist der Parameter im Typsystem optional, muss der Benutzer ihn nicht angeben.

```typescript

//funktional
new App().command('test', (name?: string) => {
    console.log('Hello', name || 'nobody');
});

//Klasse
class TestCommand {
    async execute(name?: string) {
        console.log('Hello', name || 'nobody');
    }
}
```

```sh
$ ts-node app.ts test
Hello nobody
```

Dasselbe gilt für Parameter mit einem Standardwert:

```typescript
//funktional
new App().command('test', (name: string = 'body') => {
    console.log('Hello', name);
});

//Klasse
class TestCommand {
    async execute(name: string = 'body') {
        console.log('Hello', name);
    }
}
```

```sh
$ ts-node app.ts test
Hello nobody
```

Dies gilt in gleicher Weise auch für Flags.


## Serialisierung / Validierung

Alle Argumente und Flags werden basierend auf ihren Typen automatisch deserialisiert, validiert und können mit zusätzlichen Einschränkungen versehen werden.

So ist z. B. bei als number definierten Argumenten im Controller stets garantiert, dass es sich um echte Zahlen handelt, obwohl die Kommandozeile auf Text bzw. Strings basiert. 

```typescript
//funktional
new App().command('test', (id: number) => {
    console.log('id', id, typeof id);
});

//Klasse
class TestCommand {
    async execute(id: number) {
        console.log('id', id, typeof id);
    }
}
```

```sh
$ ts-node app.ts test 123
id 123 number
```

Zusätzliche Einschränkungen können mit den Typannotationen aus `@deepkit/type` definiert werden.

```typescript
import { Positive } from '@deepkit/type';
//funktional
new App().command('test', (id: number & Positive) => {
    console.log('id', id, typeof id);
});

//Klasse
class TestCommand {
    async execute(id: number & Positive) {
        console.log('id', id, typeof id);
    }
}
```

Der Typ `Postive` in `id` gibt an, dass nur positive Zahlen erlaubt sind. Übergibt der Benutzer nun eine negative Zahl, wird der Code überhaupt nicht ausgeführt und eine Fehlermeldung angezeigt.

```sh
$ ts-node app.ts test -123
Validation error in id: Number needs to be positive [positive]
```

Diese zusätzliche, sehr einfach einzurichtende Validierung macht den Befehl deutlich robuster gegenüber falschen Eingaben. Weitere Informationen finden Sie im Kapitel [Validierung](../runtime-types/validation.md).

## Beschreibung

Um ein Flag oder Argument zu beschreiben, verwenden Sie den `@description`-Kommentar-Decorator.

```typescript
import { Positive } from '@deepkit/type';

class TestCommand {
    async execute(
        /** @description Die Benutzerkennung */
        id: number & Positive,
        /** @description Benutzer löschen? */
        remove: boolean = false
    ) {
        console.log('id', id, typeof id);
    }
}
```

In der Hilfeansicht erscheint diese Beschreibung nach dem Flag bzw. Argument:

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test ID

ARGUMENTS
  ID  The users identifier

OPTIONS
  --remove  Delete the user?
```