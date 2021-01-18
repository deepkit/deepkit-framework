import { t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { getBSONDecoder } from '../../src/bson-jit-parser';
import { getBSONSerializer } from '../../src/bson-serialize';

test('partial', () => {
    class User {
        @t id: number = 0;
        @t name: string = '';
    }

    class Model {
        @t id: number = 0;

        @t defaultValue: number = 5;
        @t manager?: User;
    }

    {
        const s = t.schema({
            v: t.type(Model),
        });
        const bson = getBSONSerializer(s)({ v: { id: 4 } });
        const value = getBSONDecoder(s)(bson);
        expect(value.v).toBeInstanceOf(Model);
        expect(value).toEqual({ v: { id: 4, defaultValue: 5 } });
    }

    {
        const s = t.schema({
            v: t.partial(Model),
        });
        {
            const bson = getBSONSerializer(s)({ v: { id: 4 } });
            const value = getBSONDecoder(s)(bson);
            expect(value.v).not.toBeInstanceOf(Model);
            expect(value).toEqual({ v: { id: 4 } });
        }

        {
            const bson = getBSONSerializer(s)({ v: { id: 4, manager: { id: 23, name: 'peter' } } });
            const value = getBSONDecoder(s)(bson);
            expect(value.v).not.toBeInstanceOf(Model);
            expect(value.v.manager).toBeInstanceOf(User); //in partials we have full instances
            expect(value).toEqual({ v: { id: 4, manager: { id: 23, name: 'peter' } } });
        }
    }
    {
        const s = t.schema({
            v: t.array(t.partial(Model)),
        });
        {
            const bson = getBSONSerializer(s)({ v: [{ id: 4 }, { id: 5 }] });
            const value = getBSONDecoder(s)(bson);
            expect(value.v).not.toBeInstanceOf(Model);
            expect(value).toEqual({ v: [{ id: 4 }, { id: 5 }] });
        }
    }
});
