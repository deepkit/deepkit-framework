import 'jest-extended';
import 'reflect-metadata';
import {getClassSchema, t} from '../src/decorators';
import {emptySerializer, getClassToXFunction, getGeneratedJitFunctionFromClass, getJitFunctionXToClass, getXToClassFunction, plainSerializer, uuid} from '../index';

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

test('nested types correctly converted', async () => {
    class Config {
        @t.uuid id: string = uuid();
        @t name: string = '';
        @t.any value: any;
    }

    class Test {
        @t.primary.uuid
        id: string = uuid();

        @t.array(Config)
        configs: Config[] = [];
    }

    {
        const test = new Test;
        const config = new Config();
        config.name = 'asd';
        test.configs.push(config);
        const plain = plainSerializer.for(Test).serialize(test);
        expect(plain).not.toBeInstanceOf(Test);
        expect(plain.configs[0].name).toBe('asd');
        expect(plain.configs[0]).not.toBeInstanceOf(Config);
    }

    expect(getGeneratedJitFunctionFromClass(getClassSchema(Test), plainSerializer)).toBeInstanceOf(Function);
});

test('different origin', async () => {
    class Test {
        @t date: Date = new Date;
    }

    const mySerializer = new class extends emptySerializer.fork('myFormat') {
    };

    mySerializer.fromClass.register('date', (setter, accessor) => {
        return `${setter} = 'my:' + ${accessor}.toJSON();`;
    });

    mySerializer.toClass.register('date', (setter, accessor) => {
        return `${setter} = new Date(${accessor}.substr('my:'.length));`;
    });

    {
        const d = mySerializer.for(Test).deserialize({date: 'my:2018-10-13T12:17:35.000Z'});
        expect(d.date).toEqual(new Date('2018-10-13T12:17:35.000Z'));
    }

    {
        const d = mySerializer.for(Test).serialize({date: new Date('2018-10-13T12:17:35.000Z')});
        expect(d.date).toEqual('my:2018-10-13T12:17:35.000Z');
    }

    {
        const d = mySerializer.for(Test).to(plainSerializer, {date: 'my:2018-10-13T12:17:35.000Z'});
        expect(d.date).toEqual('2018-10-13T12:17:35.000Z');
    }

    {
        const d = mySerializer.for(Test).from(plainSerializer, {date: '2018-10-13T12:17:35.000Z'});
        expect(d.date).toEqual('my:2018-10-13T12:17:35.000Z');
    }
});

test('custom serialization formats', async () => {
    class Test {
        @t id: string = 'myName';
        @t number: number = 0;
    }

    const mySerializer = new class extends plainSerializer.fork('myFormat') {
        serializedSingleType: any;
        serializedType: any;
    };

    mySerializer.fromClass.register('string', (setter, accessor) => {
        return {template: `${setter} = 'string:' + ${accessor}`, context: {}};
    });

    mySerializer.toClass.register('string', (setter, accessor) => {
        return {template: `${setter} = (''+${accessor}).substr(${'string'.length + 1})`, context: {}};
    });
    const scopedSerializer = mySerializer.for(Test);

    expect(plainSerializer.toClass.get('number')).toBeFunction();
    expect(mySerializer.toClass.get('number')).toBeFunction();

    expect(getClassSchema(Test).getClassProperties().get('id')!.type).toBe('string');

    const test = new Test;
    const myFormat = getClassToXFunction(getClassSchema(Test), mySerializer)(test);
    console.log('myFormat', myFormat);
    const plain = getClassToXFunction(getClassSchema(Test), plainSerializer)(test);
    expect(plain.id).toBe('myName');
    expect(myFormat.id).toBe('string:myName');
    expect(getGeneratedJitFunctionFromClass(getClassSchema(Test), mySerializer)).toBeInstanceOf(Function);
    expect(getGeneratedJitFunctionFromClass(getClassSchema(Test), plainSerializer)).toBeInstanceOf(Function);

    const testBack = getXToClassFunction(getClassSchema(Test), mySerializer)(myFormat);
    const testBackClass = getXToClassFunction(getClassSchema(Test), plainSerializer)(myFormat);
    expect(testBack.id).toBe('myName');
    expect(testBackClass.id).toBe('string:myName');
    expect(getJitFunctionXToClass(getClassSchema(Test), mySerializer)).toBeInstanceOf(Function);
    expect(getJitFunctionXToClass(getClassSchema(Test), plainSerializer)).toBeInstanceOf(Function);

    {
        expect(scopedSerializer.serializeProperty('id', 123)).toBe('string:123');
        expect(scopedSerializer.serializeProperty('id', '123')).toBe('string:123');
    }

    {
        expect(scopedSerializer.deserializeProperty('id', 'string:123')).toBe('123');
    }

    {
        //no compiler found for number, so it should pick the parent
        expect(scopedSerializer.deserializeProperty('number', '123')).toBe(123);
    }
});
