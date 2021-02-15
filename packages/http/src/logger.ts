import { injectable } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';
import { eventDispatcher } from '@deepkit/event';
import { httpWorkflow } from './http';

@injectable()
export class HttpLogger {
    constructor(private logger: Logger) {
    }

    @eventDispatcher.listen(httpWorkflow.onResponse, 101) //101 is right after 100 default listener
    onHttpRequest(event: typeof httpWorkflow.onResponse.event) {
        this.logger.log(
            event.request.connection.remoteAddress, '-',
            event.request.method,
            `"${event.request.url}"`,
            event.response.statusCode,
            `"${event.request.headers.referer || ''}"`,
            // `"${event.request.headers['user-agent']}"`,
        );
    }
}
