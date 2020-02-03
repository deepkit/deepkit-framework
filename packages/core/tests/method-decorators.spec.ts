import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {f, getClassSchema, PartialField, PropertySchema} from "../src/decorators";
import {
    argumentClassToPlain,
    argumentPlainToClass,
    methodResultClassToPlain,
    methodResultPlainToClass,
    plainToClass,
    validateMethodArgs
} from "..";

test('Basic array', () => {
    class Other {
    }

    class Controller {
        @f.array(Other).decorated()
        protected readonly bar: Other[] = [];
    }

    const s = getClassSchema(Controller);
    {
        const prop = s.getProperty('bar');
        expect(prop.name).toBe('bar');
        expect(prop.type).toBe('class');
        expect(prop.resolveClassType).toBe(Other);
        expect(prop.isArray).toBe(true);
    }
});

test('short @f 2', () => {
    class Controller {
        public foo(@f.array(String) bar: string[]): string {
            return '';
        }

        @f.array(Number)
        public foo2(@f.map(String) bar: { [name: string]: string }): number[] {
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

        expect(props).toBeArrayOfSize(1);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(true);
    }

    {
        const method = s.getMethod('foo2');
        expect(method.name).toBe('foo2');
        expect(method.type).toBe('number');
        expect(method.isArray).toBe(true);

        const props = s.getMethodProperties('foo2');

        expect(props).toBeArrayOfSize(1);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');
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
        expect(errors[0].message).toBe('Invalid type. Expected array, but got string');
        expect(errors[0].path).toBe('#0');
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', [['asd']]);
        expect(errors.length).toBe(0);
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', [[1]]);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('invalid_string');
        expect(errors[0].message).toBe('No String given');
        expect(errors[0].path).toBe('#0.0');
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', [[{'asd': 'sa'}]]);
        expect(errors.length).toBe(1);
        expect(errors[0].code).toBe('invalid_string');
        expect(errors[0].message).toBe('No String given');
        expect(errors[0].path).toBe('#0.0');
    }
});

test('short @f unmet array definition', () => {
    expect(() => {
        class Controller {
            public foo(@f bar: string[]) {
            }
        }
    }).toThrow('Controller::foo::0 type mismatch. Given nothing, but declared is Array')
});

test('short @f no index on arg', () => {
    expect(() => {
        class Controller {
            public foo(@f.index() bar: string[]) {
            }
        }
    }).toThrow('Index could not be used on method arguments')
});

test('method args', () => {
    class Controller {
        public foo(@f bar: string) {
        }

        public foo2(@f bar: string, optional?: true, @f.optional() anotherOne?: boolean) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props).toBeArrayOfSize(1);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');
    }

    {
        const props = s.getMethodProperties('foo2');

        expect(props).toBeArrayOfSize(3);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');

        expect(props[1].name).toBe('1');
        expect(props[1].type).toBe('boolean');

        expect(props[2].name).toBe('2');
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
        public foo(@f bar: string) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props).toBeArrayOfSize(1);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(false);
    }
});


test('short @f multi', () => {
    class Controller {
        public foo(@f bar: string, @f foo: number) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props).toBeArrayOfSize(2);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(false);

        expect(props[1].name).toBe('1');
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

    }).toThrow('Method foo has no decorators used, so reflection does not work');
});

test('partial', () => {
    class Config {
        @f
        name!: string;

        @f
        sub!: Config;

        @f
        prio: number = 0;
    }

    class User {
        @f.partial(Config)
        config: Partial<Config> = {};

        @f.forwardPartial(() => Config)
        config2: Partial<Config> = {};
    }

    const s = getClassSchema(User);
    expect(s.getProperty('config').isPartial).toBe(true);
    expect(s.getProperty('config').getResolvedClassType()).toBe(Config);

    expect(s.getProperty('config2').isPartial).toBe(true);
    expect(s.getProperty('config2').getResolvedClassType()).toBe(Config);

    const u = plainToClass(User, {
        config: {
            name: 'peter',
            'sub.name': 'peter2',
            'sub.prio': '3',
        }
    });

    expect(u.config).not.toBeInstanceOf(Config);
    expect(u.config.name).toBe('peter');
    expect(u.config.prio).toBeUndefined();
    expect(u.config['sub.name']).toBe('peter2');
    expect(u.config['sub.prio']).toBe(3);
});

test('argument partial', () => {
    class Config {
        @f
        name!: string;

        @f.optional()
        sub?: Config;
    }

    class User {
        foo(@f.partial(Config) config: Partial<Config>) {
        }

        @f
        foo2(config: Config) {
        }
    }

    expect(validateMethodArgs(User, 'foo', [{}])).toBeArrayOfSize(0);
    expect(validateMethodArgs(User, 'foo', [{name: undefined}])).toEqual([{"code": "required", "message": "Required value is undefined", "path": "#0.name"}]);
    expect(validateMethodArgs(User, 'foo', [{name: []}])).toEqual([{"code": "invalid_string", "message": "No String given", "path": "#0.name"}]);
    expect(validateMethodArgs(User, 'foo', [{name: ''}])).toEqual([]);
    expect(validateMethodArgs(User, 'foo2', [{}])).toEqual([{"code": "required", "message": "Required value is undefined", "path": "#0.name"}]);
    expect(validateMethodArgs(User, 'foo2', [{name: 'asd', sub: undefined}])).toEqual([]);
    expect(validateMethodArgs(User, 'foo2', [{name: 'asd', sub: {peter: true}}])).toEqual([{"code": "required", "message": "Required value is undefined", "path": "#0.sub.name"}]);
});

test('argument convertion', () => {
    class Config {
        @f.optional()
        name?: string;

        @f.optional()
        sub?: Config;

        @f
        prio: number = 0;
    }

    class Controller {
        @f.partial(Config)
        foo(name: string): PartialField<Config> {
            return {prio: 2, 'sub.name': name};
        }

        @f
        bar(config: Config): Config {
            config.name = 'peter';
            return config;
        }
    }

    {
        const name = argumentClassToPlain(Controller, 'foo', 0, 2);
        expect(name).toBe('2');

        const res = methodResultClassToPlain(Controller, 'foo', {'sub.name': 3});
        expect(res['sub.name']).toBe('3');
    }

    {
        const config = argumentPlainToClass(Controller, 'bar', 0, {prio: '2'});
        expect(config).toBeInstanceOf(Config);
        expect(config.prio).toBe(2);

        const res = methodResultPlainToClass(Controller, 'bar', {'sub': {name: 3}});
        expect(res).toBeInstanceOf(Config);
        expect(res.sub).toBeInstanceOf(Config);
        expect(res.sub.name).toBe('3');
    }
});

test('short @f multi gap', () => {
    class Controller {
        public foo(@f bar: string, nothing: boolean, @f foo: number) {
        }

        @f
        public undefined(bar: string, nothing: boolean) {
        }

        public onlyFirst(@f.array(String) bar: string[], nothing: boolean) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props).toBeArrayOfSize(3);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(false);

        expect(props[1].name).toBe('1');
        expect(props[1].type).toBe('boolean');

        expect(props[2].name).toBe('2');
        expect(props[2].type).toBe('number');
        expect(props[2].isArray).toBe(false);
    }
    {
        const props = s.getMethodProperties('undefined');

        expect(props).toBeArrayOfSize(2);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');

        expect(props[1].name).toBe('1');
        expect(props[1].type).toBe('boolean');
    }
    {
        const props = s.getMethodProperties('onlyFirst');

        expect(props).toBeArrayOfSize(2);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(true);

        expect(props[1].name).toBe('1');
        expect(props[1].type).toBe('boolean');
    }
    {
        const errors = validateMethodArgs(Controller, 'foo', []);
        expect(errors.length).toBe(3);
    }
});


test('short @f with type', () => {
    class Controller {
        public foo(@f.array(String) bar: string[]) {
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethodProperties('foo');

        expect(props).toBeArrayOfSize(1);
        expect(props[0].name).toBe('0');
        expect(props[0].type).toBe('string');
        expect(props[0].isArray).toBe(true);
    }
});

test('hasMethod and templateArgs', () => {
    class Peter<T, K> {

    }

    function myCustom(target: object, p1: any, p2: any) {
    }

    class Controller {
        public foo(@f.array(String) bar: string[]): string[] {
            return [];
        }

        @f.array(String)
        public foo2(@f.array(String) bar: string[]): string[] {
            return [];
        }

        @f.type(Peter).template(Boolean, String)
        public foo3(@f.array(String) bar: string[]): Peter<boolean, string> {
            return new Peter;
        }

        @myCustom
        public async foo4(@f.array(String) bar: string[]): Promise<string> {
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
    expect(s.hasMethod('foo4')).toBe(false);

    expect(s.getMethod('foo3').getTemplateArg(0)!.type).toBe('boolean');
    expect(s.getMethod('foo3').getTemplateArg(1)!.type).toBe('string');
});


test('short @f second type fails', () => {
    expect(() => {
        class Controller {
            public foo(@f.array(String).asMap() bar: string[]) {
            }
        }
    }).toThrow('Field is already defined as array')
});

test('short @f second type fails', () => {
    expect(() => {
        class Controller {
            public foo(@f.map(String).asArray() bar: {}) {
            }
        }
    }).toThrow('Field is already defined as map')
});


test('short @f templateArgs', () => {
    class Observable<T> {
        constructor(protected cb: (observer: { next: (v: T) => void }) => void) {

        }
    }

    class Controller {
        @f.template(Number)
        public foo(): Observable<number> {
            return new Observable((observer) => {
                observer.next(3);
            })
        }

        @f.template(f.type(String).optional())
        public foo2(): Observable<string | undefined> {
            return new Observable((observer) => {
                observer.next('2');
            })
        }
    }

    const s = getClassSchema(Controller);
    {
        const props = s.getMethod('foo');
        expect(props.getResolvedClassType()).toBe(Observable);
        expect(props.templateArgs).not.toBeUndefined();
        expect(props.templateArgs).toBeArrayOfSize(1);
        if (props.templateArgs) {
            expect(props.templateArgs[0]).toBeInstanceOf(PropertySchema);
            expect(props.templateArgs[0].name).toBe('0');
            expect(props.templateArgs[0].type).toBe('number');
            expect(props.templateArgs[0].isOptional).toBe(false);
        }
    }

    {
        const props = s.getMethod('foo2');
        expect(props.getResolvedClassType()).toBe(Observable);
        expect(props.templateArgs).not.toBeUndefined();
        expect(props.templateArgs).toBeArrayOfSize(1);
        if (props.templateArgs) {
            expect(props.templateArgs[0]).toBeInstanceOf(PropertySchema);
            expect(props.templateArgs[0].name).toBe('0');
            expect(props.templateArgs[0].isOptional).toBe(true);
            expect(props.templateArgs[0].type).toBe('string');
        }
    }
});

test('PropertySchema setFromJSValue', () => {
    {
        const p = new PropertySchema('');
        p.setFromJSValue(1);
        expect(p.type).toBe('number')
    }

    {
        const p = new PropertySchema('');
        p.setFromJSValue(null);
        expect(p.type).toBe('any')
    }

    class Peter {}

    {
        const p = new PropertySchema('');
        p.setFromJSValue(new Peter);
        expect(p.type).toBe('class');
        expect(p.resolveClassType).toBe(Peter);
    }
});


test('set any param', () => {
    class Controller {
        async streamCsvFile(path: string, @f.any() rows: any[][]): Promise<boolean> {
            return true;
        }
    }
    const s = getClassSchema(Controller);

    {
        const props = s.getMethodProperties('streamCsvFile');
        expect(props).toBeArrayOfSize(2);
        expect(props[1].type).toBe('any');
    }
});
