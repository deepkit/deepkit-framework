import 'jest-extended';
import 'reflect-metadata';
import {
    emptySerializer,
    getClassSchema,
    getClassToXFunction,
    getGeneratedJitFunctionFromClass,
    getJitFunctionXToClass,
    getXToClassFunction,
    JSONSerializer,
    jsonSerializer,
    Serializer,
    t,
    uuid
} from '../index';

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
        const plain = jsonSerializer.for(Test).serialize(test);
        expect(plain).not.toBeInstanceOf(Test);
        expect(plain.configs[0].name).toBe('asd');
        expect(plain.configs[0]).not.toBeInstanceOf(Config);
    }

    expect(getGeneratedJitFunctionFromClass(getClassSchema(Test), jsonSerializer)).toBeInstanceOf(Function);
});

test('different origin', async () => {
    class Test {
        @t date: Date = new Date;
    }

    const mySerializer = new class extends emptySerializer.fork('myFormat') {
    };

    mySerializer.fromClass.register('date', (property, state) => {
        state.addSetter(`'my:' + ${state.accessor}.toJSON()`);
    });

    mySerializer.toClass.register('date', (property, state) => {
        state.addSetter(`new Date(${state.accessor}.substr('my:'.length))`);
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
        const d = mySerializer.for(Test).to(jsonSerializer, {date: 'my:2018-10-13T12:17:35.000Z'});
        expect(d.date).toEqual('2018-10-13T12:17:35.000Z');
    }

    {
        const d = mySerializer.for(Test).from(jsonSerializer, {date: '2018-10-13T12:17:35.000Z'});
        expect(d.date).toEqual('my:2018-10-13T12:17:35.000Z');
    }
});

test('custom serialization formats', async () => {
    class Test {
        @t id: string = 'myName';
        @t number: number = 0;
    }

    const mySerializer = new class extends jsonSerializer.fork('myFormat') {
        serializedSingleType: any;
        serializedType: any;
    };

    mySerializer.fromClass.register('string', (property, state) => {
        state.addSetter(`'string:' + ${state.accessor}`);
    });

    mySerializer.toClass.register('string', (property, state) => {
        state.addSetter(`(''+${state.accessor}).substr(${'string'.length + 1})`);
    });
    const scopedSerializer = mySerializer.for(Test);

    expect(jsonSerializer.toClass.get('number')).toBeFunction();
    expect(mySerializer.toClass.get('number')).toBeFunction();

    expect(getClassSchema(Test).getClassProperties().get('id')!.type).toBe('string');

    const test = new Test;
    const myFormat = getClassToXFunction(getClassSchema(Test), mySerializer)(test);
    console.log('myFormat', myFormat);
    const plain = getClassToXFunction(getClassSchema(Test), jsonSerializer)(test);
    expect(plain.id).toBe('myName');
    expect(myFormat.id).toBe('string:myName');
    expect(getGeneratedJitFunctionFromClass(getClassSchema(Test), mySerializer)).toBeInstanceOf(Function);
    expect(getGeneratedJitFunctionFromClass(getClassSchema(Test), jsonSerializer)).toBeInstanceOf(Function);

    const testBack = getXToClassFunction(getClassSchema(Test), mySerializer)(myFormat);
    const testBackClass = getXToClassFunction(getClassSchema(Test), jsonSerializer)(myFormat);
    expect(testBack.id).toBe('myName');
    expect(testBackClass.id).toBe('string:myName');
    expect(getJitFunctionXToClass(getClassSchema(Test), mySerializer)).toBeInstanceOf(Function);
    expect(getJitFunctionXToClass(getClassSchema(Test), jsonSerializer)).toBeInstanceOf(Function);

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

test('multi level extend', async () => {
    const base = new JSONSerializer();
    let baseCalled = 0;
    base.fromClass.register('number', (property, state) => {
        baseCalled++;
        state.addSetter(`${state.accessor}`);
    });

    const middle = new (base.fork('middle'));
    let middleCalled = 0;

    middle.fromClass.prepend('number', (property, state) => {
        middleCalled++;
        if (property.name === 'id') {
            state.addSetter(`100`);
            state.forceEnd();
        }
    });

    const end = new (middle.fork('end'));

    class Peter {
        @t id: number = 0;
    }

    const s = t.schema({
        id: t.number,
        logins: t.number
    });

    const result = end.for(s).serialize({id: 5, logins: 124});
    expect(result).toEqual({id: 100, logins: 124});
    expect(baseCalled).toBe(1);
    expect(middleCalled).toBe(2);
});


test('inheritance', () => {
    const baseSerializer = new Serializer('base');

    baseSerializer.fromClass.register('date', (property, state) => {
        // expect(compiler.serializerCompilers).toBe(noDateSerializer.fromClass);
        state.addSetter(`${state.accessor}.toJSON()`);
    });

    baseSerializer.fromClass.register('class', (property, state) => {
        const classSchema = getClassSchema(property.resolveClassType!);
        const classToX = state.setVariable('classToX', state.jitStack.getOrCreate(classSchema, () => getClassToXFunction(classSchema, state.serializerCompilers.serializer, state.jitStack)));

        state.addSetter(`${classToX}.fn(${state.accessor}, _options);`);
    });

    const noDateSerializer = new (baseSerializer.fork('noDate'));
    noDateSerializer.fromClass.noop('date');

    const s = t.schema({
        created: t.date,
    });

    const baseRes = baseSerializer.for(s).serialize({created: new Date()});
    expect(typeof baseRes.created).toBe('string');

    const s2 = t.schema({
        moderator: s,
        created: t.date,
    });

    const res = noDateSerializer.for(s2).serialize({moderator: {created: new Date()}, created: new Date()});
    expect(res.created).toBeInstanceOf(Date);
    expect(res.moderator.created).toBeInstanceOf(Date);
});
