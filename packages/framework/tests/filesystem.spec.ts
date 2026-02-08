import { expect, test } from '@jest/globals';

import { App } from '@deepkit/app';
import { Filesystem, FilesystemMemoryAdapter, NamedFilesystem, provideFilesystem, provideNamedFilesystem } from '@deepkit/filesystem';

test('default provider', async () => {
    const app = new App({
        providers: [provideFilesystem(new FilesystemMemoryAdapter())],
    });

    const fs = app.get(Filesystem);
    expect(fs).toBeInstanceOf(Filesystem);

    await fs.write('hello.txt', 'hello world');
    expect((await fs.get('hello.txt')).path).toBe('/hello.txt');
    expect(await fs.readAsText('hello.txt')).toBe('hello world');
});

test('multiple providers', async () => {
    const app = new App({
        providers: [provideNamedFilesystem('fs1', new FilesystemMemoryAdapter()), provideNamedFilesystem('fs2', new FilesystemMemoryAdapter())],
    });

    type Filesystem2 = NamedFilesystem<'fs2'>;

    const fs1 = app.get<NamedFilesystem<'fs1'>>();
    const fs2 = app.get<Filesystem2>();

    expect(fs1).toBeInstanceOf(Filesystem);
    expect(fs2).toBeInstanceOf(Filesystem);

    await fs1.write('hello1.txt', 'hello world');
    await fs2.write('hello2.txt', 'hello world2');

    expect(await fs1.exists('hello1.txt')).toBe(true);
    expect(await fs1.exists('hello2.txt')).toBe(false);

    expect(await fs2.exists('hello1.txt')).toBe(false);
    expect(await fs2.exists('hello2.txt')).toBe(true);
});
