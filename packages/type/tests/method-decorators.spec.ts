import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { getClassSchema, jsonSerializer, PartialField, PropertySchema, t, validateMethodArgs } from '../index';

test('Basic array', () => {
    class Other {
    }

    class Controller {
        @t.array(Other).decorated
        protected readonly bar: Other[] = [];
    }

    const s = getClassSchema(Controller);
    {
        const prop = s.getProperty('bar');
        expect(prop.name).toBe('bar');
        expect(prop.type).toBe('array');
        expect(prop.getSubType().type).toBe('class');
        expect(prop.getSubType().resolveClassType).toBe(Other);
        expect(prop.isArray).toBe(true);
    }
});

test('short @f 2', () => {
    class Controller {
        public foo(@t.array(String) bar: string[]): string {
            return '';
        }

        @t.array(Number)
        public foo2(@t.map(String) bar: { [name: string]: string }): number[] {
            return [];
        }
    }

    const s = getClassSchema(Controller);
    {
        const method = s.getMethod('foo');
        expect(method.name).toBe('foo');
        expect(method.type).toBe('string');
        expect(method.isArray).toBe(false);

        const props = s.getMethodProperties('foo');

        expect(props.length).toBe(1);
        expect(props[0].name).toBe('bar');
        expect(props[0].getSubType().type).toBe('string');
        expect(props[0].isArray).toBe(true);
    }

    {
        const method = s.getMethod('foo2');
        expect(method.name).toBe('foo2');
        expect(method.getSubType().type).toBe('number');
        expect(method.isArray).toBe(true);

        const props = s.getMethodProperties('foo2');

        expect(props.length).toBe(1);
        expect(props[0].name).toBe('bar');
        expect(props[0].getSubType().type).toBe('string');
        expect(props[0].isMap).toBe(true);
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', []);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('required');
        expect(errors[0].message).toBe('Required value is undefined');
        expect(errors[0].path).toBe('#0');
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', ['asd']);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('invalid_type');
        expect(errors[0].message).toBe('Type is not an array');
        expect(errors[0].path).toBe('#0');
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', [['asd']]);
        expect(errors).toEqual([]);
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', [[1]]);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('invalid_string');
        expect(errors[0].message).toBe('No string given');
        expect(errors[0].path).toBe('#0.0');
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', [[{ 'asd': 'sa' }]]);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('invalid_string');
        expect(errors[0].message).toBe('No string given');
        expect(errors[0].path).toBe('#0.0');
    }
});

test('short @f unmet array definition', () => {
    expect(() => {
        class Controller {
            public foo(@t bar: string[]) {
            }
        }
    }).toThrow('Controller::foo::bar type mismatch. Given nothing, but declared is Array');
});

test('short @f no index on arg', () => {
    expect(() => {
        class Controller {
            public foo(@t.index() bar: string[]) {
            }
        }
    }).toThrow('Index could not be used on method arguments');
});

test('method args', () => {
    class Controller {
        public foo(@t bar: string) {
        }

        public foo2(@t bar: string, optional?: true, @t.optional anotherOne?: boolean) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props.length).toBe(1);
        expect(props[0].name).toBe('bar');
        expect(props[0].type).toBe('string');
    }

    {
        const props = s.getMethodProperties('foo2');

        expect(props.length).toBe(3);
        expect(props[0].name).toBe('bar');
        expect(props[0].type).toBe('string');

        expect(props[1].name).toBe('optional');
        expect(props[1].type).toBe('boolean');

        expect(props[2].name).toBe('anotherOne');
        expect(props[2].type).toBe('boolean');
        expect(props[2].isOptional).toBe(true);
    }
    {
        const errors = validateMethodArgs(Controller, 'foo2', ['bar']);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('required');
        expect(errors[0].message).toBe('Required value is undefined');
        expect(errors[0].path).toBe('#1');
    }
    {
        const errors = validateMethodArgs(Controller, 'foo2', ['bar', true]);
        expect(errors.length).toBe(0);
    }
});


test('short @f', () => {
    class Controller {
        public foo(@t bar: string) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props.length).toBe(1);
        expect(props[0].name).toBe('bar');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(false);
    }
});


test('short @f multi', () => {
    class Controller {
        public foo(@t bar: string, @t foo: number) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props.length).toBe(2);
        expect(props[0].name).toBe('bar');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(false);

        expect(props[1].name).toBe('foo');
        expect(props[1].type).toBe('number');
        expect(props[1].isArray).toBe(false);
    }
});


test('no decorators', () => {
    expect(() => {
        class Controller {
            public foo(bar: string, nothing: boolean) {
            }
        }

        const s = getClassSchema(Controller);
        s.getMethodProperties('foo');

    }).toThrow('Method Controller.foo has no decorators used');
});

test('partial', () => {
    class Config {
        @t.required
        name!: string;

        @t.required
        sub!: Config;

        @t.required
        prio: number = 0;
    }

    class User {
        @t.partial(Config)
        config: Partial<Config> = {};

        @t.partial(() => Config)
        config2: Partial<Config> = {};
    }

    const s = getClassSchema(User);

    const config = getClassSchema(Config);
    expect(config.getProperty('name').isOptional).toBe(false);

    expect(s.getProperty('config').isPartial).toBe(true);
     //partial creates a new schema with all properties being optional
    expect(s.getProperty('config').getSubType().getResolvedClassType()).not.toBe(Config);
    expect(s.getProperty('config').getSubType().getResolvedClassSchema().getProperty('name').isOptional).toBe(true);

    expect(s.getProperty('config2').isPartial).toBe(true);
    expect(s.getProperty('config2').getSubType().getResolvedClassType()).not.toBe(Config);

    const u = jsonSerializer.for(User).deserialize({
        config: {
            name: 'peter',
        }
    });

    expect(u.config).not.toBeInstanceOf(Config);
    expect(u.config.name).toBe('peter');
    expect(u.config.prio).toBeUndefined();
});

test('argument partial', () => {
    class Config {
        @t.required
        name!: string;

        @t
        sub?: Config;
    }

    class User {
        foo(@t.partial(Config) config: Partial<Config>) {
        }

        @t
        foo2(config: Config) {
        }
    }

    expect(validateMethodArgs(User, 'foo', [{}]).length).toBe(0);
    //for optional values its allowed to set to undefined. How else would you reset an already set value?
    expect(validateMethodArgs(User, 'foo', [{ name: undefined }])).toEqual([]);
    expect(validateMethodArgs(User, 'foo', [{ name: [] }])).toEqual([{ 'code': 'invalid_string', 'message': 'No string given', 'path': '#0.name' }]);
    expect(validateMethodArgs(User, 'foo', [{ name: '' }])).toEqual([]);

    const userSchema = getClassSchema(User);
    const [configProperty] = userSchema.getMethodProperties('foo2');
    expect(configProperty.name).toBe('config');
    expect(configProperty.isOptional).toBe(false);

    const configSchema = getClassSchema(Config);
    expect(configSchema.getProperty('name').isOptional).toBe(false);

    expect(validateMethodArgs(User, 'foo2', [{}])).toEqual([{ 'code': 'required', 'message': 'Required value is undefined', 'path': '#0.name' }]);
    expect(validateMethodArgs(User, 'foo2', [{ name: 'asd', sub: undefined }])).toEqual([]);
    expect(validateMethodArgs(User, 'foo2', [{ name: 'asd', sub: { peter: true } }])).toEqual([{ 'code': 'required', 'message': 'Required value is undefined', 'path': '#0.sub.name' }]);
});

test('argument convertion', () => {
    class Config {
        @t.optional
        name?: string;

        @t.optional
        sub?: Config;

        @t
        prio: number = 0;
    }

    class Controller {
        @t.partial(Config)
        foo(name: string): PartialField<Config> {
            return { prio: 2, 'sub.name': name };
        }

        @t
        bar(config: Config): Config {
            config.name = 'peter';
            return config;
        }
    }

    const schema = getClassSchema(Controller);
    expect(schema.getMethodProperties('foo')[0].type).toBe('string');

    {
        const name = jsonSerializer.for(Controller).serializeMethodArgument('foo', 0, 2);
        expect(name).toBe(2);

        const res = jsonSerializer.for(Controller).deserializeMethodResult('foo', { name: 3 });
        expect(res).toEqual({ name: '3' });
    }

    {
        const config = jsonSerializer.for(Controller).deserializeMethodArgument('bar', 0, { prio: '2' });
        expect(config).toBeInstanceOf(Config);
        expect(config.prio).toBe(2);

        const res = jsonSerializer.for(Controller).deserializeMethodResult('bar', { 'sub': { name: 3 } });
        expect(res).toBeInstanceOf(Config);
        expect(res.sub).toBeInstanceOf(Config);
        expect(res.sub.name).toBe('3');
    }
});

test('short @f multi gap', () => {
    class Controller {
        public foo(@t bar: string, nothing: boolean, @t foo: number) {
        }

        @t
        public undefined(bar: string, nothing: boolean) {
        }

        public onlyFirst(@t.array(String) bar: string[], nothing: boolean) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props.length).toBe(3);
        expect(props[0].name).toBe('bar');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(false);

        expect(props[1].name).toBe('nothing');
        expect(props[1].type).toBe('boolean');

        expect(props[2].name).toBe('foo');
        expect(props[2].type).toBe('number');
        expect(props[2].isArray).toBe(false);
    }
    {
        const props = s.getMethodProperties('undefined');

        expect(props.length).toBe(2);
        expect(props[0].name).toBe('bar');
        expect(props[0].type).toBe('string');

        expect(props[1].name).toBe('nothing');
        expect(props[1].type).toBe('boolean');
    }
    {
        const props = s.getMethodProperties('onlyFirst');

        expect(props.length).toBe(2);
        expect(props[0].name).toBe('bar');
        expect(props[0].getSubType().type).toBe('string');
        expect(props[0].isArray).toBe(true);

        expect(props[1].name).toBe('nothing');
        expect(props[1].type).toBe('boolean');
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', []);
        expect(errors.length).toBe(3);
    }
});


test('short @f with type', () => {
    class Controller {
        public foo(@t.array(String) bar: string[]) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props.length).toBe(1);
        expect(props[0].name).toBe('bar');
        expect(props[0].getSubType().type).toBe('string');
        expect(props[0].isArray).toBe(true);
    }
});

test('hasMethod and templateArgs', () => {
    class Peter<T, K> {

    }

    function myCustom(target: object, p1: any, p2: any) {
    }

    class Controller {
        public foo(@t.array(String) bar: string[]): string[] {
            return [];
        }

        @t.array(String)
        public foo2(@t.array(String) bar: string[]): string[] {
            return [];
        }

        @t.type(Peter).template(Boolean, String)
        public foo3(@t.array(String) bar: string[]): Peter<boolean, string> {
            return new Peter;
        }

        @myCustom
        public async foo4(@t.array(String) bar: string[]): Promise<string> {
            return 'sd';
        }
    }

    const s = getClassSchema(Controller);
    expect(s.hasMethod('foo')).toBe(false);
    expect(s.hasMethod('foo2')).toBe(true);
    expect(s.hasMethod('foo3')).toBe(true);
    expect(s.hasMethod('foo4')).toBe(false);

    expect(s.getMethod('foo3').getTemplateArg(0)!.type).toBe('boolean');
    expect(s.getMethod('foo3').getTemplateArg(1)!.type).toBe('string');

    s.getMethodProperties('foo2');
    s.getMethodProperties('foo3');
    s.getMethodProperties('foo4');
    expect(s.hasMethod('foo')).toBe(false);
    expect(s.hasMethod('foo2')).toBe(true);
    expect(s.hasMethod('foo3')).toBe(true);
    expect(s.hasMethod('foo4')).toBe(true);

    expect(s.getMethod('foo3').getTemplateArg(0)!.type).toBe('boolean');
    expect(s.getMethod('foo3').getTemplateArg(1)!.type).toBe('string');
});

test('short @f templateArgs', () => {
    class Observable<T> {
        constructor(protected cb: (observer: { next: (v: T) => void }) => void) {

        }
    }

    class Controller {
        @t.template(Number)
        public foo(): Observable<number> {
            return new Observable((observer) => {
                observer.next(3);
            });
        }

        @t.template(t.string.optional)
        public foo2(): Observable<string | undefined> {
            return new Observable((observer) => {
                observer.next('2');
            });
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethod('foo');
        expect(props.getResolvedClassType()).toBe(Observable);
        expect(props.templateArgs).not.toBeUndefined();
        expect(props.templateArgs.length).toBe(1);
        if (props.templateArgs) {
            expect(props.templateArgs[0]).toBeInstanceOf(PropertySchema);
            expect(props.templateArgs[0].name).toBe('foo_0');
            expect(props.templateArgs[0].type).toBe('number');
            expect(props.templateArgs[0].isOptional).toBe(false);
        }
    }

    {
        const props = s.getMethod('foo2');
        expect(props.getResolvedClassType()).toBe(Observable);
        expect(props.templateArgs).not.toBeUndefined();
        expect(props.templateArgs.length).toBe(1);
        if (props.templateArgs) {
            expect(props.templateArgs[0]).toBeInstanceOf(PropertySchema);
            expect(props.templateArgs[0].name).toBe('foo2_0');
            expect(props.templateArgs[0].isOptional).toBe(true);
            expect(props.templateArgs[0].type).toBe('string');
        }
    }
});

test('PropertySchema setFromJSValue', () => {
    {
        const p = new PropertySchema('');
        p.setFromJSValue(1);
        expect(p.type).toBe('number');
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue('2');
        expect(p.type).toBe('string');
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue(true);
        expect(p.type).toBe('boolean');
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue({});
        expect(p.type).toBe('any');
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue(new Uint8Array());
        expect(p.type).toBe('Uint8Array');
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue(new ArrayBuffer(0));
        expect(p.type).toBe('arrayBuffer');
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue([]);
        expect(p.type).toBe('array');
        expect(p.getSubType().type).toBe('any');
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue(null);
        expect(p.type).toBe('any');
    }

    class Peter {
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue(new Peter);
        expect(p.type).toBe('class');
        expect(p.resolveClassType).toBe(Peter);
    }
});


test('set any param', () => {
    class Controller {
        async streamCsvFile(path: string, @t.any rows: any[][]): Promise<boolean> {
            return true;
        }
    }

    const s = getClassSchema(Controller);

    {
        const props = s.getMethodProperties('streamCsvFile');
        expect(props.length).toBe(2);
        expect(props[1].type).toBe('any');
    }
});

test('set any [][]', () => {
    class Controller {
        async streamCsvFile(path: string, @t.array(t.array(t.string)) rows: string[][]): Promise<boolean> {
            return true;
        }
    }

    const s = getClassSchema(Controller);

    {
        const props = s.getMethodProperties('streamCsvFile');
        expect(props.length).toBe(2);
        expect(props[0].type).toBe('string');
        expect(props[1].type).toBe('array');
        expect(props[1].getSubType().type).toBe('array');
        expect(props[1].getSubType().getSubType().type).toBe('string');
    }
});


test('set array result', () => {
    function DummyDecorator() {
        return (target: Object, property: string) => {
        };
    }

    class Item {
        constructor(
            @t public title: string
        ) {
        }
    }

    class Controller {
        @DummyDecorator()
        items1(): Item[] {
            return [];
        }

        @DummyDecorator()
        async items2(): Promise<Item[]> {
            return [];
        }

        @t.any
        items3(): Item[] {
            return [];
        }

        @t.any
        async items4(): Promise<Item[]> {
            return [];
        }
    }

    const s = getClassSchema(Controller);

    {
        const prop = s.getMethod('items1');
        expect(prop.isArray).toBe(true);
        expect(prop.getSubType().type).toBe('any');
    }

    {
        expect(s.getMethod('items2').classType).toBe(Promise);
    }

    {
        const prop = s.getMethod('items3');
        expect(prop.type).toBe('any');
        expect(prop.isArray).toBe(false); //because we explicitly set any()
    }

    {
        const prop = s.getMethod('items4');
        expect(prop.type).toBe('any');
        expect(prop.isArray).toBe(false);
    }
});
