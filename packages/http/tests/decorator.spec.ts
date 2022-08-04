import { expect, test } from '@jest/globals';
import { http, httpClass } from '../src/decorator';

test('groups', async () => {
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
        expect(httpData.getAction('a').groups).toEqual(['all', 'a']);
        expect(httpData.getAction('b').groups).toEqual(['all']);
        expect(httpData.getAction('c').groups).toEqual(['all', 'c']);
    }

    {
        @http.controller().group('group1', 'group2', 'duplicate')
        class Controller {
            @http.GET().group('group3', 'group4', 'duplicate')
            action() {}
        }
        const httpData = httpClass._fetch(Controller);
        if (!httpData) throw new Error('httpClass undefined');
        expect(httpData.getAction('action').groups).toEqual(['group1', 'group2', 'duplicate', 'group3', 'group4']);
    }
});
