import { test, expect } from '@jest/globals';
import { Service } from '../src/app/service';
import { Logger, MemoryLoggerTransport } from '@deepkit/logger';
import { createTestingApp } from '@deepkit/framework';

test('first test', () => {
    expect(1 + 1).toBe(2);
});

test('service directly', () => {
    const memoryLogger = new MemoryLoggerTransport;
    const logger = new Logger([memoryLogger]);
    const service = new Service(logger);

    const result = service.doIt();
    expect(result).toBe(true);
    expect(memoryLogger.messages[0]).toMatchObject({message: 'Hello from the Service'});
});

test('service via DI container', () => {
    const testing = createTestingApp({
        providers: [Service]
    });

    const service = testing.app.get(Service);

    const result = service.doIt();
    expect(result).toBe(true);
});
