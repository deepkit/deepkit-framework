import { expect, test } from '@jest/globals';
import { http, httpClass } from '../src/decorator';

test('group order', async () => {
    @http.controller().group('group1', 'group2', 'duplicate')
    class Controller {
        @http.GET().group('group3', 'group4', 'duplicate')
        action() {}
    }
    expect(httpClass._fetch(Controller)?.getAction('action')).toMatchObject({
        groups: ['group1', 'group2', 'duplicate', 'group3', 'group4'],
    });
});
