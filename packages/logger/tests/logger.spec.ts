import { expect, test } from '@jest/globals';
import { JSONTransport, Logger, LoggerLevel, MemoryLogger, ScopedLogger, ScopeFormatter } from '../src/logger.js';
import { MemoryLoggerTransport } from '../src/memory-logger.js';
import { Injector, ServiceNotFoundError, TransientInjectionTarget } from '@deepkit/injector';

test('log level', () => {
    const logger = new Logger();

    expect(logger.is(LoggerLevel.alert)).toBe(true);
    expect(logger.is(LoggerLevel.error)).toBe(true);
    expect(logger.is(LoggerLevel.warning)).toBe(true);
    expect(logger.is(LoggerLevel.log)).toBe(true);
    expect(logger.is(LoggerLevel.info)).toBe(true);
    expect(logger.is(LoggerLevel.debug)).toBe(false);

    logger.level = LoggerLevel.error;

    expect(logger.is(LoggerLevel.alert)).toBe(true);
    expect(logger.is(LoggerLevel.error)).toBe(true);
    expect(logger.is(LoggerLevel.warning)).toBe(false);
    expect(logger.is(LoggerLevel.log)).toBe(false);
    expect(logger.is(LoggerLevel.info)).toBe(false);
    expect(logger.is(LoggerLevel.debug)).toBe(false);
});

test('log message', () => {
    const memory = new MemoryLoggerTransport();
    const logger = new Logger([memory]);

    logger.log('Peter');

    expect(memory.messageStrings).toEqual(['Peter']);
});

test('log scope 1', () => {
    const memory = new MemoryLoggerTransport();
    const logger = new Logger([memory], [new ScopeFormatter()]);
    logger.level = LoggerLevel.error;

    const scoped = logger.scoped('database');

    scoped.error('Peter');

    expect(memory.messageStrings).toEqual(['(database) Peter']);
    expect(scoped.level).toBe(LoggerLevel.error);
});

test('log scope 2', () => {
    const logger = new MemoryLogger(undefined, [new ScopeFormatter()]);
    logger.level = LoggerLevel.error;

    const scoped = logger.scoped('database');
    scoped.error('Peter');

    expect(logger.memory.messageStrings).toEqual(['(database) Peter']);
    expect(scoped.level).toBe(LoggerLevel.error);
});

test('log data', () => {
    const memory = new MemoryLoggerTransport();
    const logger = new Logger([memory]);

    class User {
    }

    logger.log('Peter', { user: new User });

    expect(memory.messages[0].message).toEqual('Peter { user: User {} }');

    memory.clear();

    logger.data({ user: new User }).log('Peter');
    expect(memory.messages[0].message).toEqual('Peter');
    expect(memory.messages[0].data.user).toBeInstanceOf(User);

    memory.clear();
    logger.log({ user: new User });

    expect(memory.messages[0].message).toEqual('{ user: User {} }');
});

test('colorless', () => {
    const jsonLogger = new JSONTransport();
    jsonLogger.out = {
        write: (message: string) => {
            expect(message).toContain(`This is a color test`);
        },
    };

    const logger = new Logger([jsonLogger]);

    logger.log('This is a <yellow>color</yellow> test');
});

test('scope catches late changes', () => {
    const logger = new MemoryLogger(undefined, [new ScopeFormatter()]);
    const scoped = logger.scoped('database');
    expect(scoped).toBeInstanceOf(Logger);

    logger.level = LoggerLevel.debug;
    scoped.debug('test');
    expect(logger.memory.messageStrings).toEqual(['(database) test']);

    scoped.log('test2');
    expect(logger.memory.messageStrings).toEqual(['(database) test', '(database) test2']);

    logger.log('test3');
    expect(logger.memory.messageStrings).toEqual(['(database) test', '(database) test2', 'test3' ]);
});

test('scoped logger 1', () => {
    class MyProvider {
        constructor(public logger: ScopedLogger) {
        }
    }

    class AnotherProvider {
        constructor(public myProvider: MyProvider, public logger: ScopedLogger) {
        }
    }

    {
        const injector = Injector.from([
            MyProvider,
            AnotherProvider,
            Logger, // optional base logger used by ScopedLogger
            ScopedLogger,
        ]);
        const logger = injector.get(Logger);
        expect(logger).toBeInstanceOf(Logger);

        const anotherProvider = injector.get(AnotherProvider);
        expect(anotherProvider.logger).toBeInstanceOf(Logger);
        expect(anotherProvider.myProvider.logger.scope).toBe('MyProvider');
        expect(anotherProvider.logger.scope).toBe('AnotherProvider');
    }
});

test('scoped logger 2', () => {
    class MyProvider {
        constructor(public logger: ScopedLogger) {
        }
    }

    class AnotherProvider {
        constructor(public logger: ScopedLogger, public myProvider: MyProvider) {
        }
    }

    {
        const injector = Injector.from([
            MyProvider,
            AnotherProvider,
            Logger, // optional base logger used by ScopedLogger
            ScopedLogger,
        ]);
        const logger = injector.get(Logger);
        expect(logger).toBeInstanceOf(Logger);

        const anotherProvider = injector.get(AnotherProvider);
        expect(anotherProvider.logger).toBeInstanceOf(Logger);
        expect(anotherProvider.myProvider.logger.scope).toBe('MyProvider');
        expect(anotherProvider.logger.scope).toBe('AnotherProvider');
    }

    {
        const injector = Injector.from([
            MyProvider,
            ScopedLogger,
        ]);
        expect(() => injector.get(Logger)).toThrow(ServiceNotFoundError);
        const provider = injector.get(MyProvider);
        expect(provider.logger).toBeInstanceOf(Logger);
    }

    {
        class A {
            constructor(public b: C) {
            }
        }

        class B {
            constructor(public target: TransientInjectionTarget) {
            }
        }

        class C {
            constructor(public target: TransientInjectionTarget) {
            }
        }

        const injector = Injector.from([
            A,
            { provide: B, transient: true },
            { provide: C, transient: true, useExisting: B },
        ]);

        const a = injector.get(A);
        expect(a.b).toBeInstanceOf(B);
        expect(a.b.target.token).toBe(A);
    }
});

test('enableDebug', () => {
    const logger = new MemoryLogger();

    logger.setScopeLevel('database', LoggerLevel.debug);
    logger.debug('test1');
    expect(logger.getScopeLevel('database')).toBe(LoggerLevel.debug);

    const scoped = logger.scoped('database');
    scoped.debug('test2');
    expect(scoped.getScopeLevel('database')).toBe(LoggerLevel.debug);
    expect(scoped.isScopeEnabled('database')).toBe(true);

    expect(logger.memory.messageStrings).toEqual(['test2']);
});

test('enableDebug2', () => {
    const logger = new MemoryLogger();
    logger.level = LoggerLevel.debug;

    logger.setScopeLevel('database', LoggerLevel.error);
    logger.debug('test1');
    expect(logger.getScopeLevel('database')).toBe(LoggerLevel.error);

    const scoped = logger.scoped('database');
    scoped.debug('test2');
    expect(logger.getScopeLevel('database')).toBe(LoggerLevel.error);
    expect(logger.memory.messageStrings).toEqual(['test1']);

    logger.unsetScopeLevel('database');
    scoped.debug('test3');
    expect(logger.memory.messageStrings).toEqual(['test1', 'test3']);
});

test('setLevel', () => {
    const logger = new MemoryLogger();
    logger.setLevel('debug');
    expect(logger.level).toBe(LoggerLevel.debug);
    logger.debug('test');
    expect(logger.memory.messageStrings).toEqual(['test']);
});
