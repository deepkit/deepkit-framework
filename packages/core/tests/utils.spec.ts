import { test } from 'node:test';
import { expect } from '@deepkit/run/expect';

import { urlJoin } from '../src/url.js';

test('urlJoin', async () => {
    expect(urlJoin('base', 'path')).toBe('base/path');
    expect(urlJoin('', 'base', 'path')).toBe('base/path');
    expect(urlJoin('/', 'base', 'path')).toBe('/base/path');

    expect(urlJoin('/', '', 'path')).toBe('/path');
    expect(urlJoin(undefined as any, '', 'path')).toBe('path');

    expect(urlJoin('path')).toBe('path');
    expect(urlJoin('/path')).toBe('/path');
    expect(urlJoin('/path/')).toBe('/path/');

    expect(urlJoin('/path/', 'sub')).toBe('/path/sub');
    expect(urlJoin('/path/', '/sub')).toBe('/path/sub');
    expect(urlJoin('/path///', '/sub')).toBe('/path/sub');
    expect(urlJoin('/path///', '//sub///')).toBe('/path/sub/');
    expect(urlJoin('////path///', '//sub///')).toBe('/path/sub/');
});
