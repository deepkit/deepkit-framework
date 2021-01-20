/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { IncomingMessage, ServerResponse } from 'http';

export class HttpResponse extends ServerResponse {
    status(code: number) {
        this.writeHead(code);
        this.end();
    }
}

export class HttpRequest extends IncomingMessage {
    getUrl(): string {
        return this.url || '/';
    }

    getMethod(): string {
        return this.method || 'GET';
    }

    getRemoteAddress(): string {
        return this.connection.remoteAddress || '';
    }
}
