import { Logger, MemoryLoggerTransport, ScopedLogger } from '@deepkit/logger';
import { expect, test } from '@jest/globals';
import { App } from '../src/app.js';

test('logger', () => {
    const memory = new MemoryLoggerTransport();

    const app = new App({
        providers: [{ provide: Logger, useValue: new Logger([memory]) }]
    });

    const logger = app.get<Logger>();
    logger.log('hello world');

    expect(memory.messageStrings).toEqual(['hello world']);
});

test('scoped logger', () => {
    const memory = new MemoryLoggerTransport();

    class Service {
        constructor(public logger: ScopedLogger) {
        }
    }

    const app = new App({
        providers: [
            Service,
            { provide: Logger, useValue: new Logger([memory]) },
        ]
    });

    const service = app.get<Service>();
    service.logger.log('hello world');

    expect(memory.messages[0].scope).toEqual('Service');
});
