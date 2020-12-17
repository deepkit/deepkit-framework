/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import style from 'ansi-styles';
import util from 'util';
import {ClassType} from '@deepkit/core';
import {inject} from './injector/injector';
import {Debugger} from './debug/debugger';

export enum LoggerLevel {
    alert,
    error,
    warning,
    log,
    info,
    debug,
}


export class ConsoleTransport implements Transport {
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

export interface Transport {
    write(message: string, level: LoggerLevel): void;

    supportsColor(): boolean;
}

export interface Formatter {
    format(message: string, level: LoggerLevel): string;
}

export class ColorFormatter implements Formatter {
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

export class RemoveColorFormatter implements Formatter {
    format(message: string, level: LoggerLevel): string {
        if (message.includes('<')) {
            message = message.replace(/<(\/)?([a-zA-Z]+)>/g, function (a, end, color) {
                return '';
            });
        }
        return message;
    }
}

export class TimestampFormatter implements Formatter {
    format(message: string, level: LoggerLevel): string {
        return `<yellow>${new Date().toISOString()}</yellow> [${String(LoggerLevel[level]).toUpperCase()}] ${message}`;
    }
}

export class Logger {
    protected colorFormatter = new ColorFormatter;
    protected removeColorFormatter = new RemoveColorFormatter;

    @inject().optional
    protected debugger?: Debugger;

    constructor(
        protected transport: Transport[] = [],
        protected formatter: Formatter[] = [],
    ) {
    }

    addTransport(transport: Transport) {
        this.transport.push(transport);
    }

    hasFormatter(formatterType: ClassType<Formatter>) {
        for (const formatter of this.formatter) {
            if (formatter instanceof formatterType) return true;
        }
        return false;
    }

    addFormatter(formatter: Formatter) {
        this.formatter.push(formatter);
    }

    protected format(message: string, level: LoggerLevel): string {
        for (const formatter of this.formatter) {
            message = formatter.format(message, level);
        }
        return message;
    }

    protected send(messages: any[], level: LoggerLevel) {
        let message = this.format((util.format as any)(...messages), level);
        this.debugger?.log(this.colorFormatter.format(message, level));

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
