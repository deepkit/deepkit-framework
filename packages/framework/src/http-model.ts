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

export type HttpRequestQuery = {[name: string]: string};
export type HttpRequestResolvedParameters = {[name: string]: any};

export class HttpRequest extends IncomingMessage {
    /**
     * A store that can be used to transport data from guards/listeners to ParameterResolvers/controllers.
     */
    public store: {[name: string]: any} = {};

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
