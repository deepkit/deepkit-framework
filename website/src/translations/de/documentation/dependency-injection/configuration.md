# Konfiguration

Der Dependency Injection Container ermöglicht ebenfalls, Konfigurationsoptionen zu injizieren. Diese Konfigurationsinjektion kann über Constructor Injection oder Property Injection empfangen werden.

Die Module API unterstützt die Definition einer Konfigurationsdefinition, die eine reguläre Class ist. Indem man einer solchen Class Properties gibt, fungiert jede Property als Konfigurationsoption. Aufgrund der Art, wie Classes in TypeScript definiert werden können, lässt sich pro Property ein Type und Standardwerte festlegen.

```typescript
class RootConfiguration {
    domain: string = 'localhost';
    debug: boolean = false;
}

const rootModule = new InjectorModule([UserRepository])
     .setConfigDefinition(RootConfiguration)
     .addImport(lowLevelModule);
```

Die Konfigurationsoptionen `domain` und `debug` können nun bequem und typesafe in Providern verwendet werden.

```typescript
class UserRepository {
    constructor(private debug: RootConfiguration['debug']) {}

    getUsers() {
        if (this.debug) console.debug('fetching users ...');
    }
}
```

Die Werte der Optionen selbst können über `configure()` gesetzt werden.

```typescript
	rootModule.configure({debug: true});
```

Optionen, die keinen Standardwert haben, aber dennoch erforderlich sind, können mit einem `!` versehen werden. Das zwingt den Benutzer des Moduls, den Wert zu liefern; andernfalls tritt ein Error auf.

```typescript
class RootConfiguration {
    domain!: string;
}
```

## Validierung

Außerdem können alle Serialization- und Validation-Types aus den vorherigen Kapiteln [Validierung](../runtime-types/validation.md) und [Serialisierung](../runtime-types/serialization.md) verwendet werden, um präzise festzulegen, welche Type- und Inhaltsbeschränkungen eine Option haben muss.

```typescript
class RootConfiguration {
    domain!: string & MinLength<4>;
}
```

## Injektion

Konfigurationsoptionen können, wie andere Abhängigkeiten, sicher und einfach über den DI-Container injiziert werden, wie zuvor gezeigt. Die einfachste Methode ist, eine einzelne Option mithilfe des Indexzugriffsoperators zu referenzieren:

```typescript
class WebsiteController {
    constructor(private debug: RootConfiguration['debug']) {}

    home() {
        if (this.debug) console.debug('visit home page');
    }
}
```

Konfigurationsoptionen können nicht nur einzeln, sondern auch als Gruppe referenziert werden. Hierfür wird der TypeScript Utility Type `Partial` verwendet:

```typescript
class WebsiteController {
    constructor(private options: Partial<RootConfiguration, 'debug' | 'domain'>) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

Um alle Konfigurationsoptionen zu erhalten, kann auch die Konfigurations-Class direkt referenziert werden:

```typescript
class WebsiteController {
    constructor(private options: RootConfiguration) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

Es wird jedoch empfohlen, nur die Konfigurationsoptionen zu referenzieren, die tatsächlich verwendet werden. Das vereinfacht nicht nur Unit-Tests, sondern macht auch leichter ersichtlich, was der Code tatsächlich benötigt.