import { expect, test } from '@jest/globals';
import { transpile, transpileAndRun } from './utils';

test('function __type', () => {
    const res = transpile({ app: `function log(message: string) {}` });
    console.log(res);
    expect(res.app).toContain('log.__type = ');
});

test('resolve import ts', () => {
    const res = transpile({
        'app': `
            import { Logger } from './logger';
            function fn(logger: Logger) {}
        `,
        'logger': `export class Logger {}`
    });

    console.log(res);
    expect(res.app).toContain('() => logger_1.Logger');
    expect(res.logger).toContain('Logger.__type =');
});

test('resolve import d.ts', () => {
    const res = transpile({
        'app': `
            import { Logger } from './logger';
            function fn(logger: Logger) {}
        `,
        'logger.d.ts': `export declare class Logger {}`
    });

    console.log(res);
    expect(res.app).toContain('() => logger_1.Logger');
});

test('resolve import node_modules', () => {
    const res = transpile({
        'app': `
            import { Logger } from 'logger';
            function fn(logger: Logger) {}
        `,
        'node_modules/logger/index.d.ts': `export declare class Logger {}`
    });

    console.log(res);
    expect(res.app).toContain('() => logger_1.Logger');
});

test('pass type argument named function', () => {
    const res = transpile({
        'app': `
            function getType<T>(type?: ReceiveType<T>) {
            }

            getType<string>();
        `
    });

    console.log(res);
});

test('pass type argument named function second param', () => {
    const res = transpile({
        'app': `
            type ReceiveType<T> = Packed | Type | ClassType<T>;

            function getType<T>(first: string = 1, type?: ReceiveType<T>) {
            }

            getType<string>();
        `
    });

    console.log(res);
});

test('pass type argument property access', () => {
    const res = transpile({
        'app': `
            class Database {
                query<T>(type?: ReceiveType<T>) {}
            }

            const db = new Database;
            db.query<string>();
        `
    });

    console.log(res);
});

test('pass type argument arrow function', () => {
    const res = transpile({
        'app': `
            (<T>(type?: ReceiveType<T>) => {})<string>();
        `
    });

    console.log(res);
});

test('globals', () => {
    const res = transpile({
        'app': `
            interface User {}
            export type a = Partial<User>;
        `
    });

    expect(res.app).toContain('const __ΩPartial = ');
    expect(res.app).toContain('() => __ΩPartial');
});

test('chained methods two calls', () => {
    const res = transpileAndRun({
        'app': `
            const types: any[] = [];
            class Http {
                response<T>(type?: ReceiveType<T>) {
                    types.push(type);
                    return this;
                }
            }
            const http = new Http;
            http.response<1>().response<2>();
            types;
        `
    });

    console.log(res);
    expect(res).toEqual([[1, '.!'], [2, '.!']]);
});

test('chained methods two calls, one without', () => {
    const res = transpileAndRun({
        'app': `
            const types: any[] = [];
            class Http {
                response<T>(type?: ReceiveType<T>) {
                    types.push(type);
                    return this;
                }
            }
            const http = new Http;
            http.response().response<2>();
            types;
        `
    });

    console.log(res);
    expect(res).toEqual([undefined, [2, '.!']]);
});

test('chained methods three calls', () => {
    const res = transpileAndRun({
        'app': `
            const types: any[] = [];
            class Http {
                response<T>(type?: ReceiveType<T>) {
                    types.push(type);
                    return this;
                }
            }
            const http = new Http;
            http.response<1>().response<2>().response<3>();
            types;
        `
    });

    console.log(res);
    expect(res).toEqual([[1, '.!'], [2, '.!'], [3, '.!']]);
});

test('chained methods three calls one without', () => {
    const res = transpileAndRun({
        'app': `
            const types: any[] = [];
            class Http {
                GET(path: string) { return this }
                response<T>(n: number, desc: string, type?: ReceiveType<T>) {
                    types.push(type);
                    return this;
                }
            }
            const http = new Http;
            http.GET('/action3')
                .response<2>(200, \`List\`)
                .response<3>(400, \`Error\`);

            types;
        `
    });

    console.log(res);
    expect(res).toEqual([[2, '.!'], [3, '.!']]);
});

test('multiple calls optional types', () => {
    const res = transpileAndRun({
        'app': `
            const types: any[] = [];
            function add<T>(type?: ReceiveType<T>) {
                types.push(type);
            }
            add<1>();
            add();
            types;
        `
    });

    console.log(res);
    expect(res).toEqual([[1, '.!'], undefined]);
});

test('multiple deep calls optional types', () => {
    const res = transpileAndRun({
        'app': `
            const types: any[] = [];
            function add<T>(type?: ReceiveType<T>) {
                types.push(type);
                add2();
            }
            function add2<T>(type?: ReceiveType<T>) {
                types.push(type);
            }
            add<1>();
            add();
            types;
        `
    });

    console.log(res);
    expect(res).toEqual([[1, '.!'], undefined, undefined, undefined]);
});

test('chained optional methods', () => {
    const res = transpileAndRun({
        'app': `
            const types: any[] = [];
            class Http {
                response<T>(type?: ReceiveType<T>) {
                    types.push(type);
                    return this;
                }
            }
            const http = new Http;
            http.response<1>().response();
            types;
        `
    });

    console.log(res);
    expect(res).toEqual([[1, '.!'], undefined]);
});

test('readonly constructor properties', () => {
    const res = transpileAndRun({
        'app': `
           class User {
              constructor(readonly id: number) {}
           }
        `
    });

    console.log(res);
});

test('readonly array', () => {
    const res = transpileAndRun({
        'app': `
            interface Post {
                id: number;
            }

            interface User {
                readonly id: number;
                readonly posts: readonly Post[]
            }
        `
    });

    console.log(res);
});

test('enum union', () => {
    const res = transpileAndRun({
        'app': `
            enum StatEnginePowerUnit {
                Hp,
            }

            enum StatWeightUnit {
                Lbs,
                Kg,
            }

            type StatMeasurementUnit = StatEnginePowerUnit | StatWeightUnit;
            typeOf<StatMeasurementUnit>()
        `
    });

    console.log(res);
});
