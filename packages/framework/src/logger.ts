import * as style from 'ansi-styles';
import * as util from 'util';
import {ClassType} from '@deepkit/core';

enum LoggerLevel {
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
        return `<yellow>${new Date().toISOString()}</yellow> ${message}`;
    }
}

export class Logger {
    protected colorFormatter = new ColorFormatter;
    protected removeColorFormatter = new RemoveColorFormatter;

    constructor(protected transport: Transport[], protected formatter: Formatter[] = []) {
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
