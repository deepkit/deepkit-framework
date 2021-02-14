import { LoggerLevel, LoggerTransport } from "./logger";

export class MemoryLoggerTransport implements LoggerTransport {
    public messages: { level: LoggerLevel, message: string }[] = [];
    public messageStrings: string[] = [];

    write(message: string, level: LoggerLevel) {
        this.messages.push({ level, message });
        this.messageStrings.push(message);
    }

    supportsColor() {
        return false;
    }
}
