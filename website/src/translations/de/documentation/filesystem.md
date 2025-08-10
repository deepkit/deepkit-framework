# Deepkit Filesystem

Deepkit Filesystem ist eine Filesystem-Abstraktion für lokale und entfernte Filesystems. Sie ermöglicht es, mit Dateien und Verzeichnissen auf einheitliche Weise zu arbeiten, unabhängig davon, ob die Dateien lokal oder auf einem entfernten Server gespeichert sind.

Unterstützte Filesystems standardmäßig:

- Lokales Filesystem (im Paket `@deepkit/filesystem`)
- Memory (im Paket `@deepkit/filesystem`)
- FTP (im Paket `@deepkit/filesystem-ftp`)
- SFTP (im Paket `@deepkit/filesystem-sftp`)
- AWS S3 (im Paket `@deepkit/filesystem-aws-s3`)
- Google Cloud Filesystem (im Paket `@deepkit/filesystem-google`)

## Installation

```bash
npm install @deepkit/filesystem
```

Hinweis: Wenn du NPM nicht verwendest, stelle sicher, dass Peer-Abhängigkeiten korrekt installiert sind.

## Verwendung

```typescript
import { Filesystem, FilesystemLocalAdapter } from '@deepkit/filesystem';

const adapter = new FilesystemLocalAdapter('/path/to/my/files');
const filesystem = new Filesystem(adapter);

const files = await filesystem.files();
for (const file of files) {
    console.log(file.path);
}

await filesystem.write('myFile.txt', 'Hello World');
const file = await filesystem.get('myFile.txt');
console.log(file.path, file.size, file.lastModified);

const content = await filesystem.read('myFile.txt');
```


## Dateien auflisten

Zum Auflisten von Dateien verwende die Methode `files()`. Sie gibt ein Array von `File`-Objekten zurück.

```typescript
const files = await filesystem.files();
for (const file of files) {
    console.log(file.path);
}
```

Wenn das Array leer ist, existiert der Ordner nicht oder es befinden sich keine Dateien darin.

Um alle Dateien rekursiv aufzulisten, verwende die Methode `allFiles()`.

```typescript
const files = await filesystem.allFiles();
for (const file of files) {
    console.log(file.path);
}
```

## Datei lesen

Um eine Datei zu lesen, verwende die Methode `read()`. Sie gibt den Dateiinhalt als `Uint8Array` zurück.

```typescript
const content = await filesystem.read('myFile.txt');
```

Um sie als Text zu lesen, verwende die Methode `readAsText()`. Sie gibt einen String zurück.

```typescript
const content = await filesystem.readAsText('myFile.txt');
```

## Datei schreiben

Um eine Datei zu schreiben, verwende die Methode `write()`. Sie akzeptiert einen `Uint8Array` oder einen String.

```typescript
await filesystem.write('myFile.txt', 'Hello World');
```

Um aus einer lokalen Datei zu schreiben, verwende die Methode `writeFile()`.

Beachte, dass das erste Argument das Verzeichnis ist, nicht der Dateiname. Der Dateiname ist der Basename der bereitgestellten Datei.
Du kannst den Dateinamen ändern, indem du ein {name: 'myFile.txt'}-Objekt als zweites Argument übergibst. Wenn keine Dateierweiterung angegeben ist,
wird die Erweiterung automatisch erkannt.

```typescript
const path = await filesystem.writeFile('/', { path: '/path/to/local/file.txt' });

// funktioniert mit UploadedFile
router.post('/upload', async (body: HttpBody<{ file: UploadedFile }>, filesystem: Filesystem, session: Session) => {
    const user = session.getUser();
    const path = await filesystem.writeFile('/user-images', body.file, { name: `user-${user.id}` });
    //path = /user-images/user-123.jpg
});
```


## Datei löschen

Um eine Datei zu löschen, verwende die Methode `delete()`.

```typescript
await filesystem.delete('myFile.txt');
```

Dies löscht die Datei `myFile.txt` im Root-Verzeichnis. Wenn der Pfad ein Verzeichnis ist, wird ein Error geworfen.

## Verzeichnis löschen

Um ein Verzeichnis zu löschen, verwende die Methode `deleteDirectory()`. Dies löscht das Verzeichnis sowie alle Dateien und Verzeichnisse darin.

```typescript
await filesystem.deleteDirectory('myFolder');
```

## Verzeichnis erstellen

Um ein Verzeichnis zu erstellen, verwende die Methode `createDirectory()`.

```typescript
await filesystem.makeDirectory('myFolder');
```

## Datei verschieben

Um eine Datei oder ein Verzeichnis zu verschieben, verwende die Methode `move()`. Sie akzeptiert ein `File`-Objekt oder einen Pfad.

```typescript
await filesystem.move('myFile.txt', 'myFolder/myFile.txt');
```

Das Verzeichnis `myFolder` wird erstellt, falls es nicht existiert.

## Datei kopieren

Um eine Datei oder ein Verzeichnis zu kopieren, verwende die Methode `copy()`. Sie akzeptiert ein `File`-Objekt oder einen Pfad.

```typescript
await filesystem.copy('myFile.txt', 'myFolder/myFile.txt');
```

Das Verzeichnis `myFolder` wird erstellt, falls es nicht existiert.

## Dateiinformationen

Um Informationen über eine Datei zu erhalten, verwende die Methode `get()`. Sie gibt ein `File`-Objekt zurück.

```typescript
const file: FilesystemFile = await filesystem.get('myFile.txt');
console.log(file.path, file.size, file.lastModified);
```

Es werden der Pfad, die Dateigröße in Bytes und das letzte Änderungsdatum zurückgegeben. Das Änderungsdatum kann undefined sein, wenn der Adapter dies nicht unterstützt.

Das File-Objekt bietet außerdem einige praktische Methoden:

```typescript
interface FilesystemFile {
    path: string;
    type: FileType; //Datei oder Verzeichnis
    size: number;
    lastModified?: Date;
    /**
     * Sichtbarkeit der Datei.
     *
     * Beachte, dass einige Adapter das Lesen der Sichtbarkeit einer Datei ggf. nicht unterstützen.
     * In diesem Fall ist die Sichtbarkeit immer 'private'.
     *
     * Einige Adapter unterstützen das Lesen der Sichtbarkeit pro Datei, jedoch nicht beim Auflisten von Dateien.
     * In diesem Fall musst du zusätzlich `filesystem.get(file)` aufrufen, um die Sichtbarkeit zu laden.
     */
    visibility: FileVisibility; //public oder private
    constructor(path: string, type?: FileType);
    /**
     * Gibt true zurück, wenn diese Datei ein symbolischer Link ist.
     */
    isFile(): boolean;
    /**
     * Gibt true zurück, wenn diese Datei ein Verzeichnis ist.
     */
    isDirectory(): boolean;
    /**
     * Gibt den Namen (Basename) der Datei zurück.
     */
    get name(): string;
    /**
     * Gibt true zurück, wenn sich diese Datei im angegebenen Verzeichnis befindet.
     */
    inDirectory(directory: string): boolean;
    /**
     * Gibt das Verzeichnis (dirname) der Datei zurück.
     */
    get directory(): string;
    /**
     * Gibt die Dateierweiterung zurück, oder einen leeren String, wenn nicht vorhanden oder ein Verzeichnis.
     */
    get extension(): string;
}
```

## Datei existiert

Um zu prüfen, ob eine Datei existiert, verwende die Methode `exists()`.

```typescript

if (await filesystem.exists('myFile.txt')) {
    console.log('File exists');
}
```

## Dateisichtbarkeit

Deepkit Filesystems unterstützt eine einfache Abstraktion für Dateisichtbarkeit, mit der Dateien public oder private gemacht werden können. 

Dies ist z. B. für S3 oder Google Cloud Filesystem nützlich. Beim lokalen Filesystem werden die Dateiberechtigungen abhängig von der Sichtbarkeit gesetzt.

Um die Sichtbarkeit einer Datei festzulegen, verwende entweder die Methode `setVisibility()` oder übergib die Sichtbarkeit als drittes Argument an `write()`.

```typescript
await filesystem.setVisibility('myFile.txt', 'public');
await filesystem.write('myFile.txt', 'Hello World', 'public');
```

Um die Sichtbarkeit einer Datei abzurufen, verwende die Methode `getVisibility()` oder prüfe `FilesystemFile.visibility`.

```typescript
const visibility = await filesystem.getVisibility('myFile.txt');
const file = await filesystem.get('myFile.txt');
console.log(file.visibility);
```

Beachte, dass einige Adapter das Abrufen der Sichtbarkeit über `sotrage.files()` ggf. nicht unterstützen. In diesem Fall ist die Sichtbarkeit immer `unknown`.

## Öffentliche URL der Datei

Um die öffentliche URL einer Datei zu erhalten, verwende die Methode `publicUrl()`. Dies funktioniert nur, wenn die Datei public ist und der Adapter dies unterstützt.

```typescript
const url = filesystem.publicUrl('myFile.txt');
```

Wenn der Adapter keine öffentlichen URLs unterstützt, übernimmt die Filesystem-Abstraktion dies, indem sie eine URL über `option.baseUrl` generiert.

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
    baseUrl: 'https://my-domain.com/assets/'
});

const url = await filesystem.publicUrl('myFile.txt');
console.log(url); //https://my-domain.com/assets/myFile.txt
```

## Filesystem-Optionen

Der `Filesystem`-Konstruktor akzeptiert als zweites Argument ein Options-Objekt.

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
    visibility: 'private', //Standard-Sichtbarkeit für Dateien
    directoryVisibility: 'private', //Standard-Sichtbarkeit für Verzeichnisse
    pathNormalizer: (path: string) => path, //normalisiert den Pfad. Standardmäßig wird `[^a-zA-Z0-9\.\-\_]` durch `-` ersetzt.
    urlBuilder: (path: string) => path, //erstellt die öffentliche URL für eine Datei. Standardmäßig: baseUrl + path
    baseUrl: '', //Basis-URL für öffentliche URLs
});
```