import { ConsoleTransport, Logger, LoggerInterface, TimestampFormatter } from '@deepkit/logger';

export class DatabaseLogger {
    public logger?: LoggerInterface;

    public active: boolean = false;
    public: boolean = false;

    enableLogging(): void {
        if (!this.logger) this.logger = new Logger([new ConsoleTransport], [new TimestampFormatter]);
        this.active = true;
    }

    setLogger(logger: LoggerInterface) {
        this.logger = logger.scoped('deepkit/orm');
    }

    failedQuery(error: any, query: string, params: any[]) {
        if (!this.active || !this.logger) return;

        this.logger.error('failed query', query.trim(), params, error);
    }

    logQuery(query: string, params: any[]) {
        if (!this.active || !this.logger) return;

        this.logger.log(query.trim(), params);
    }
}
