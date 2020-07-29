import 'jest-extended';
import 'reflect-metadata';
import {getClassSchema, t} from '../src/decorators';
import {uuid} from '../src/utils';

test('new api', async () => {
    class Test {
        @t.primary.uuid
        id: string = uuid();

        @t.array(String)
        names: string[] = [];

        @t.map(t.number)
        nameMap: { [name: string]: number } = {};
    }

    const schema = getClassSchema(Test);
    expect(schema.getProperty('id').type).toBe('uuid');

    expect(schema.getProperty('names').type).toBe('array');
    expect(schema.getProperty('names').isArray).toBe(true);
    expect(schema.getProperty('names').templateArgs[0]!.type).toBe('string');

    expect(schema.getProperty('nameMap').type).toBe('map');
    expect(schema.getProperty('nameMap').isMap).toBe(true);
    expect(schema.getProperty('nameMap').templateArgs[0]!.type).toBe('any');
    expect(schema.getProperty('nameMap').templateArgs[1]!.type).toBe('number');
});
