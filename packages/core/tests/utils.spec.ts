import { expect, test } from '@jest/globals';
import { urlJoin } from '../src/url';

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
