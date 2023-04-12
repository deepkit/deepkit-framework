import { expect, test } from '@jest/globals';
import { Logger, LoggerLevel, ScopeFormatter } from '../src/logger.js';
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

    const scoped = logger.scoped('database');

    scoped.log('Peter');

    expect(memory.messageStrings).toEqual(['(database) Peter']);
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
