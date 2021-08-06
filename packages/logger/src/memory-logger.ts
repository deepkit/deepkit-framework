import { LoggerTransport, LogMessage } from './logger';

export class MemoryLoggerTransport implements LoggerTransport {
    public messages: LogMessage[] = [];
    public messageStrings: string[] = [];

    clear(): void {
        this.messages.length = 0;
        this.messageStrings.length = 0;
    }

    write(message: LogMessage) {
        this.messages.push(message);
        this.messageStrings.push(message.message);
    }

    supportsColor() {
        return false;
    }
}
