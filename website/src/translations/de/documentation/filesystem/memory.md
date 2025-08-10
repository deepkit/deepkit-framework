# In-Memory-Dateisystem

Beim In-Memory-Dateisystem wird das Dateisystem im Arbeitsspeicher gehalten. Das bedeutet, dass das Dateisystem nicht persistent ist und beim Beenden der Anwendung verloren geht.
Dies ist insbesondere für Testzwecke nützlich.

Es ist Teil von `@deepkit/filesystem`, daher ist keine zusätzliche Installation erforderlich.

## Verwendung

```typescript
import { FilesystemMemoryAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemMemoryAdapter();
const filesystem = new Filesystem(adapter);
```