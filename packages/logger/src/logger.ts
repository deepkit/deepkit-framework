/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import style from 'ansi-styles';
import format from 'format-util';
import { arrayRemoveItem, ClassType } from '@deepkit/core';

export enum LoggerLevel {
    none,
    alert,
    error,
    warning,
    log,
    info,
    debug,
}

export class ConsoleTransport implements LoggerTransport {
    write(message: string, level: LoggerLevel) {
        if (level === LoggerLevel.error) {
            process.stderr.write(message + '\n');
        } else {
            process.stdout.write(message + '\n');
        }
    }

    supportsColor() {
        return true;
    }
}

export interface LoggerTransport {
    write(message: string, level: LoggerLevel): void;

    supportsColor(): boolean;
}

export interface LoggerFormatter {
    format(message: string, level: LoggerLevel): string;
}

export class ColorFormatter implements LoggerFormatter {
    static colors: string[] = [
        'black',
        'red',
        'green',
        'yellow',
        'blue',
        'cyan',
        'magenta',
        'white',
        'gray',
        'grey',
    ];

    format(message: string, level: LoggerLevel): string {
        if (level === LoggerLevel.error || level === LoggerLevel.alert) {
            message = `<red>${message}</red>`;
        }

        if (message.includes('<')) {
            message = message.replace(/<(\/)?([a-zA-Z]+)>/g, function (a, end, color) {
                if (!(style as any)[color]) return a;
                if (end === '/') return (style as any)[color].close;
                return (style as any)[color].open;
            });
        }
        return message;
    }
}

export class RemoveColorFormatter implements LoggerFormatter {
    format(message: string, level: LoggerLevel): string {
        if (message.includes('<')) {
            message = message.replace(/<(\/)?([a-zA-Z]+)>/g, function (a, end, color) {
                return '';
            });
        }
        return message;
    }
}

export class TimestampFormatter implements LoggerFormatter {
    format(message: string, level: LoggerLevel): string {
        return `<yellow>${new Date().toISOString()}</yellow> [${String(LoggerLevel[level]).toUpperCase()}] ${message}`;
    }
}

export interface LoggerInterface {
    level: LoggerLevel;

    scoped(name: string): LoggerInterface;

    is(level: LoggerLevel): boolean;

    alert(...message: any[]): void;

    error(...message: any[]): void;

    warning(...message: any[]): void;

    log(...message: any[]): void;

    info(...message: any[]): void;

    debug(...message: any[]): void;
}

export class ScopedLogger implements LoggerInterface {
    constructor(protected parent: Logger, protected scope: string) {
    }

    scoped(name: string): LoggerInterface {
        return this.parent.scoped(name);
    }

    get level() {
        if (this.parent.scopedLevel[this.scope] !== undefined) return this.parent.scopedLevel[this.scope];

        return this.parent.level;
    }

    set level(level: LoggerLevel) {
        this.parent.scopedLevel[this.scope] = level;
    }

    is(level: LoggerLevel): boolean {
        return level <= this.level;
    }

    alert(...message: any[]) {
        this.parent.alert(`<yellow>${this.scope}</yellow>`, ...message);
    }

    error(...message: any[]) {
        this.parent.error(`<yellow>${this.scope}</yellow>`, ...message);
    }

    warning(...message: any[]) {
        this.parent.warning(`<yellow>${this.scope}</yellow>`, ...message);
    }

    log(...message: any[]) {
        this.parent.log(`<yellow>${this.scope}</yellow>`, ...message);
    }

    info(...message: any[]) {
        this.parent.info(`<yellow>${this.scope}</yellow>`, ...message);
    }

    debug(...message: any[]) {
        this.parent.debug(`<yellow>${this.scope}</yellow>`, ...message);
    }
}

export class Logger implements LoggerInterface {
    protected colorFormatter = new ColorFormatter;
    protected removeColorFormatter = new RemoveColorFormatter;

    level: LoggerLevel = LoggerLevel.info;
    scopedLevel: { [scope: string]: LoggerLevel } = {};
    protected scopes: { [scope: string]: LoggerInterface } = {};

    constructor(
        protected transport: LoggerTransport[] = [],
        protected formatter: LoggerFormatter[] = [],
    ) {
    }

    scoped(name: string): LoggerInterface {
        return this.scopes[name] ||= new ScopedLogger(this, name);
    }

    addTransport(transport: LoggerTransport) {
        this.transport.push(transport);
    }

    removeTransport(transport: LoggerTransport) {
        arrayRemoveItem(this.transport, transport);
    }

    hasFormatter(formatterType: ClassType<LoggerFormatter>) {
        for (const formatter of this.formatter) {
            if (formatter instanceof formatterType) return true;
        }
        return false;
    }

    addFormatter(formatter: LoggerFormatter) {
        this.formatter.push(formatter);
    }

    protected format(message: string, level: LoggerLevel): string {
        for (const formatter of this.formatter) {
            message = formatter.format(message, level);
        }
        return message;
    }

    is(level: LoggerLevel): boolean {
        return level <= this.level;
    }

    protected send(messages: any[], level: LoggerLevel) {
        if (!this.is(level)) return;

        let message = this.format((format as any)(...messages), level);

        for (const transport of this.transport) {
            if (transport.supportsColor()) {
                transport.write(this.colorFormatter.format(message, level), level);
            } else {
                transport.write(this.removeColorFormatter.format(message, level), level);
            }
        }
    }

    alert(...message: any[]) {
        this.send(message, LoggerLevel.alert);
    }

    error(...message: any[]) {
        this.send(message, LoggerLevel.error);
    }

    warning(...message: any[]) {
        this.send(message, LoggerLevel.warning);
    }

    log(...message: any[]) {
        this.send(message, LoggerLevel.log);
    }

    info(...message: any[]) {
        this.send(message, LoggerLevel.info);
    }

    debug(...message: any[]) {
        this.send(message, LoggerLevel.debug);
    }
}
