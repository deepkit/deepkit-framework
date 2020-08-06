import 'jest-extended';
import 'reflect-metadata';
import {getClassSchema, t} from '../src/decorators';
import {
    CacheJitPropertyConverter,
    classToPlain,
    createClassToXFunction,
    createXToClassFunction,
    getJitFunctionClassToX,
    getJitFunctionXToClass,
    registerConverterCompiler,
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
        const plain = classToPlain(Test, test);
        expect(plain).not.toBeInstanceOf(Test);
        expect(plain.configs[0].name).toBe('asd');
        expect(plain.configs[0]).not.toBeInstanceOf(Config);
    }

    expect(getJitFunctionClassToX(getClassSchema(Test))).toBeInstanceOf(Function);
});

test('custom serialization formats', async () => {
    class Test {
        @t
        id: string = 'myName';
    }

    registerConverterCompiler('class', 'myFormat', 'string', (setter, accessor) => {
        return {template: `${setter} = 'string:' + ${accessor}`, context: {}};
    });

    registerConverterCompiler('myFormat', 'class', 'string', (setter, accessor) => {
        return {template: `${setter} = (''+${accessor}).substr(${'string'.length + 1})`, context: {}};
    });

    expect(getClassSchema(Test).getClassProperties().get('id')!.type).toBe('string');

    const test = new Test;
    const myFormat = createClassToXFunction(getClassSchema(Test), 'myFormat')(test);
    const plain = createClassToXFunction(getClassSchema(Test), 'plain')(test);
    expect(plain.id).toBe('myName');
    expect(myFormat.id).toBe('string:myName');
    expect(getJitFunctionClassToX(getClassSchema(Test), 'myFormat')).toBeInstanceOf(Function);
    expect(getJitFunctionClassToX(getClassSchema(Test), 'plain')).toBeInstanceOf(Function);

    const testBack = createXToClassFunction(getClassSchema(Test), 'myFormat')(myFormat);
    const testBackClass = createXToClassFunction(getClassSchema(Test), 'plain')(myFormat);
    expect(testBack.id).toBe('myName');
    expect(testBackClass.id).toBe('string:myName');
    expect(getJitFunctionXToClass(getClassSchema(Test), 'myFormat')).toBeInstanceOf(Function);
    expect(getJitFunctionXToClass(getClassSchema(Test), 'plain')).toBeInstanceOf(Function);

    {
        const cacheJitPropertyConverter = new CacheJitPropertyConverter('class', 'myFormat');
        const converter = cacheJitPropertyConverter.getJitPropertyConverter(Test);
        expect(converter.convert('id', 123)).toBe('string:123');
        expect(converter.convert('id', '123')).toBe('string:123');
    }

    {
        const cacheJitPropertyConverter = new CacheJitPropertyConverter('myFormat', 'class');
        const converter = cacheJitPropertyConverter.getJitPropertyConverter(Test);
        expect(converter.convert('id', 'string:123')).toBe('123');
    }

    {
        //no compiler found from fromFormat to toFormat (e.g. plain to mongo)
        //we thus first convert from source format to class, then from class to target format.
        const cacheJitPropertyConverter = new CacheJitPropertyConverter('plain', 'myFormat');
        const converter = cacheJitPropertyConverter.getJitPropertyConverter(Test);
        expect(converter.convert('id', '123')).toBe('string:123');
    }
});
