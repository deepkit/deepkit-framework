import { getDirname } from '@deepkit/platform';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';

export function findParentPath(path: string, origin: string = getDirname()): string | undefined {
    let current = origin;

    while (!existsSync(join(current, path))) {
        const nextFolder = resolve(current, '..');

        if (nextFolder === current) {
            return undefined;
        }

        current = nextFolder;
    }

    return join(current, path);
}
