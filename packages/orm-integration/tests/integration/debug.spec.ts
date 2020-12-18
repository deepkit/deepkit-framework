import {expect, test} from '@jest/globals';
import 'reflect-metadata';
import {entity, t} from '@deepkit/type';
import {createEnvSetup} from './setup';
import {sqlSerializer} from '@deepkit/sql';

class DebugRequestTime {
    @t start!: number;
    @t.optional end?: number;
}

@entity.name('debugRequest')
export class DebugRequest {
    @t.primary.autoIncrement id: number = 0;
    @t version: number = 0;
    @t created: Date = new Date;
    @t.optional statusCode?: number;
    @t logs: number = 0;

    @t.map(DebugRequestTime) times: { [name: string]: DebugRequestTime } = {};

    constructor(
        @t public method: string,
        @t public url: string,
        @t public clientIp: string,
    ) {
    }
}

test('basics', async () => {
    const database = await createEnvSetup([DebugRequest]);

    const item = new DebugRequest('GET', '/', '127.0.0.1');
    item.times['test'] = {start: 213, end: 220};

    {
        const s = sqlSerializer.for(DebugRequest).deserialize(item);
        expect(s.times['test']).toEqual({start: 213, end: 220});
    }

    await database.persist(item);

    {
        const i = await database.query(DebugRequest).filter({id: item.id}).findOne();
        expect(item !== i).toBe(true);
        expect(i.times['test']).toEqual({start: 213, end: 220});
    }
});
