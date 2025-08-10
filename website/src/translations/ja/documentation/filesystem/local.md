# ローカルファイルシステム

ローカルファイルシステムアダプターは最も一般的なファイルシステムの一つで、アプリケーションが実行されているシステム上のファイルシステムへのアクセスを提供します。

これは `@deepkit/filesystem` の一部で、内部的に Node の `fs/promises` API を使用するため、追加のインストールは不要です。

## 使い方

```typescript
import { FilesystemLocalAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemLocalAdapter({ root: '/path/to/files' });
const filesystem = new Filesystem(adapter);
```

ここで `root` オプションはファイルシステムのルートディレクトリを指します。すべてのパスはこのルートからの相対パスです。

```typescript
// /path/to/files/hello.txt のファイルを読み込みます
const content: string = await filesystem.readAsText('/hello.txt');
```

## パーミッション

ファイルやディレクトリを作成する際に、ファイルシステムが使用するパーミッションを設定できます。各カテゴリ（file, directory）は、`public` と `private` の2つの可視性に対して個別に設定できます。

```typescript
const adapter = new FilesystemLocalAdapter({
    root: '/path/to/files',
    permissions: {
        file: {
            public: 0o644,
            private: 0o600,
        },
        directory: {
            public: 0o755,
            private: 0o700,
        }
    }
});


const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

ここでは、`/hello-public.txt` はパーミッション `0o644` で、`/hello-private.txt` は `0o600` で作成されます。