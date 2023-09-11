import { LoggerInterface } from '@deepkit/logger';
import { eventDispatcher } from '@deepkit/event';
import { httpWorkflow } from './http.js';

export class HttpLogger {
    constructor(private logger: LoggerInterface) {
    }

    @eventDispatcher.listen(httpWorkflow.onResponse, 101) //101 is right after 100 default listener
    onHttpRequest(event: typeof httpWorkflow.onResponse.event) {
        this.logger.log(
            event.request.connection.remoteAddress || '0.0.0.0', '-',
            event.request.method,
            `"${event.request.url}"`,
            event.response.statusCode,
            `"${event.request.headers.referer || ''}"`,
            // `"${event.request.headers['user-agent']}"`,
        );
    }
}
