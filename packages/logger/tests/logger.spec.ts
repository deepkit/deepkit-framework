import { expect, test } from '@jest/globals';

import { Injector, ServiceNotFoundError, TransientInjectionTarget } from '@deepkit/injector';

import { JSONTransport, Logger, LoggerLevel, ScopeFormatter, ScopedLogger } from '../src/logger.js';
import { MemoryLoggerTransport } from '../src/memory-logger.js';

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

test('log scope', () => {
    const memory = new MemoryLoggerTransport();
    const logger = new Logger([memory], [new ScopeFormatter()]);
    logger.level = LoggerLevel.error;

    const scoped = logger.scoped('database');

    scoped.error('Peter');

    expect(memory.messageStrings).toEqual(['(database) Peter']);
    expect(scoped.level).toBe(LoggerLevel.error);
});

test('log data', () => {
    const memory = new MemoryLoggerTransport();
    const logger = new Logger([memory]);

    class User {}

    logger.log('Peter', { user: new User() });

    expect(memory.messages[0].message).toEqual('Peter { user: User {} }');

    memory.clear();

    logger.data({ user: new User() }).log('Peter');
    expect(memory.messages[0].message).toEqual('Peter');
    expect(memory.messages[0].data.user).toBeInstanceOf(User);

    memory.clear();
    logger.log({ user: new User() });

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

test('scoped logger', () => {
    class MyProvider {
        constructor(public logger: ScopedLogger) {}
    }

    {
        const injector = Injector.from([
            MyProvider,
            Logger, // optional base logger used by ScopedLogger
            ScopedLogger,
        ]);
        const logger = injector.get(Logger);
        const provider = injector.get(MyProvider);
        expect(logger).toBeInstanceOf(Logger);
        expect(provider.logger).toBeInstanceOf(Logger);
        expect(provider.logger).toBe(logger.scoped('MyProvider'));
    }

    {
        const injector = Injector.from([MyProvider, ScopedLogger]);
        expect(() => injector.get(Logger)).toThrow(ServiceNotFoundError);
        const provider = injector.get(MyProvider);
        expect(provider.logger).toBeInstanceOf(Logger);
    }

    {
        class A {
            constructor(public b: B) {}
        }

        class B {
            constructor(
                public c: C,
                public target: TransientInjectionTarget,
            ) {}
        }

        class C {
            constructor(public target: TransientInjectionTarget) {}
        }

        const injector = Injector.from([A, { provide: B, transient: true }, { provide: C, transient: true }]);
        const a = injector.get(A);
        expect(a.b.c.target.token).toBe(B);
        expect(a.b.target.token).toBe(A);
    }

    {
        class A {
            constructor(public b: C) {}
        }

        class B {
            constructor(public target: TransientInjectionTarget) {}
        }

        class C {
            constructor(public target: TransientInjectionTarget) {}
        }

        const injector = Injector.from([A, { provide: B, transient: true }, { provide: C, transient: true, useExisting: B }]);

        const a = injector.get(A);
        expect(a.b).toBeInstanceOf(B);
        expect(a.b.target.token).toBe(A);
    }
});
