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
import { arrayRemoveItem, ClassType, isPlainObject } from '@deepkit/core';

export enum LoggerLevel {
    none,
    alert,
    error,
    warning,
    log,
    info,
    debug,
}

export type LogData = { [name: string]: any };

export interface LogMessage {
    message: string;
    rawMessage: string;
    date: Date;
    level: LoggerLevel;
    scope: string;
    data: LogData;
}

export class ConsoleTransport implements LoggerTransport {
    constructor(protected withColors: boolean = true) {
    }

    write(message: LogMessage): void {
        if (message.level === LoggerLevel.error) {
            process.stderr.write(message.message + '\n');
        } else {
            process.stdout.write(message.message + '\n');
        }
    }

    supportsColor() {
        return this.withColors;
    }
}

export class JSONTransport implements LoggerTransport {
    write(message: LogMessage) {
        process.stdout.write(JSON.stringify({
            message: message.rawMessage,
            level: message.level,
            date: message.date,
            scope: message.scope,
            data: message.data,
        }) + '\n');
    }

    supportsColor() {
        return false;
    }
}

export interface LoggerTransport {
    write(message: LogMessage): void;

    supportsColor(): boolean;
}

export interface LoggerFormatter {
    format(message: LogMessage): void;
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

    format(message: LogMessage): void {
        if (message.level === LoggerLevel.error || message.level === LoggerLevel.alert) {
            message.message = `<red>${message.message}</red>`;
        }

        if (message.message.includes('<')) {
            message.message = message.message.replace(/<(\/)?([a-zA-Z]+)>/g, function (a, end, color) {
                if (!(style as any)[color]) return a;
                if (end === '/') return (style as any)[color].close;
                return (style as any)[color].open;
            });
        }
    }
}

export class RemoveColorFormatter implements LoggerFormatter {
    format(message: LogMessage): void {
        if (message.message.includes('<')) {
            message.message = message.message.replace(/<(\/)?([a-zA-Z]+)>/g, function (a, end, color) {
                return '';
            });
        }
    }
}

export class DefaultFormatter implements LoggerFormatter {
    formatters: LoggerFormatter[] = [new ScopeFormatter(), new LogLevelFormatter(), new TimestampFormatter()];

    format(message: LogMessage): void {
        for (const formatter of this.formatters) {
            formatter.format(message);
        }
    }
}

export class TimestampFormatter implements LoggerFormatter {
    format(message: LogMessage): void {
        message.message = `<yellow>${new Date().toISOString()}</yellow> ${message.message}`;
    }
}

export class LogLevelFormatter implements LoggerFormatter {
    format(message: LogMessage): void {
        message.message = `[${String(LoggerLevel[message.level]).toUpperCase()}] ${message.message}`;
    }
}

export class ScopeFormatter implements LoggerFormatter {
    format(message: LogMessage): void {
        if (!message.scope) return;
        message.message = `(<yellow>${message.scope}</yellow>) ${message.message}`;
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

export class Logger implements LoggerInterface {
    protected colorFormatter = new ColorFormatter;
    protected removeColorFormatter = new RemoveColorFormatter;

    /**
     * Setting a log level means only logs below or equal to this level will be handled.
     */
    level: LoggerLevel = LoggerLevel.info;

    scopedLevel: { [scope: string]: LoggerLevel } = {};
    protected scopes: { [scope: string]: Logger } = {};

    constructor(
        protected transporter: LoggerTransport[] = [],
        protected formatter: LoggerFormatter[] = [],
        protected scope: string = '',
    ) {
    }

    scoped(name: string): Logger {
        return this.scopes[name] ||= new (this.constructor as any)(this.transporter, this.formatter, name);
    }

    addTransport(transport: LoggerTransport) {
        this.transporter.push(transport);
    }

    setTransport(transport: LoggerTransport[]) {
        this.transporter = transport;
    }

    removeTransport(transport: LoggerTransport) {
        arrayRemoveItem(this.transporter, transport);
    }

    hasFormatter(formatterType: ClassType<LoggerFormatter>) {
        for (const formatter of this.formatter) {
            if (formatter instanceof formatterType) return true;
        }
        return false;
    }

    hasFormatters(): boolean {
        return this.formatter.length > 0;
    }

    addFormatter(formatter: LoggerFormatter) {
        this.formatter.push(formatter);
    }

    setFormatter(formatter: LoggerFormatter[]) {
        this.formatter = formatter;
    }

    protected format(message: LogMessage): void {
        for (const formatter of this.formatter) {
            formatter.format(message);
        }
    }

    is(level: LoggerLevel): boolean {
        return level <= this.level;
    }

    protected send(messages: any[], level: LoggerLevel) {
        if (!this.is(level)) return;

        let data = {};
        if (messages.length > 1 && isPlainObject(messages[messages.length - 1])) {
            data = messages[messages.length - 1];
            messages.splice(messages.length - 1);
        }

        const rawMessage: string = (format as any)(...messages);
        const message: LogMessage = { message: rawMessage, rawMessage, level, date: new Date, scope: this.scope, data };
        this.format(message);

        for (const transport of this.transporter) {
            const formattedMessage = { ...message };
            if (transport.supportsColor()) {
                this.colorFormatter.format(formattedMessage);
                transport.write(formattedMessage);
            } else {
                this.removeColorFormatter.format(formattedMessage);
                transport.write(formattedMessage);
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
