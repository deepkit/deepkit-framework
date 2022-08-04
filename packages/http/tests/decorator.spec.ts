import { expect, test } from '@jest/globals';
import { http, httpClass } from '../src/decorator';

test('group basic', async () => {
    {
        class Controller {
            @http.GET('a').group('a')
            a() {}

            @http.GET('b')
            b() {}

            @http.GET('c').group('c')
            c() {}
        }

        const httpData = httpClass._fetch(Controller);
        if (!httpData) throw new Error('httpClass undefined');
        expect(httpData.getAction('a').groups).toEqual(['a']);
        expect(httpData.getAction('b').groups).toEqual([]);
        expect(httpData.getAction('c').groups).toEqual(['c']);
    }

    {
        @http.group('all')
        class Controller {
            @http.GET('a').group('a')
            a() {}

            @http.GET('b')
            b() {}

            @http.GET('c').group('c')
            c() {}
        }

        const httpData = httpClass._fetch(Controller);
        if (!httpData) throw new Error('httpClass undefined');
        expect(httpData.getAction('a').groups).toEqual(expect.arrayContaining(['a', 'all']));
        expect(httpData.getAction('b').groups).toEqual(expect.arrayContaining(['all']));
        expect(httpData.getAction('c').groups).toEqual(expect.arrayContaining(['c', 'all']));
    }
});

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
