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
import { UploadedFile } from './router';
import { Socket } from 'net';
import * as querystring from 'querystring';

export class HttpResponse extends ServerResponse {
    status(code: number) {
        this.writeHead(code);
        this.end();
    }
}

export type HttpRequestQuery = { [name: string]: string };
export type HttpRequestResolvedParameters = { [name: string]: any };

export class RequestBuilder {
    protected contentBuffer: Buffer = Buffer.alloc(0);
    protected headers: { [name: string]: string } = {};
    protected queryPath?: string;

    constructor(
        protected path: string,
        protected method: string = 'GET',
    ) {
    }

    getUrl() {
        if (this.queryPath) {
            return this.path + '?' + this.queryPath;
        }
        return this.path;
    }

    build(): HttpRequest {
        const headers = this.headers;
        const method = this.method;
        const url = this.getUrl();
        const bodyContent = this.contentBuffer;

        return new (class extends HttpRequest {
            url = url;
            method = method;
            position = 0;

            headers = headers;

            done = false;

            _read(size: number) {
                if (this.done) {
                    this.push(null);
                } else {
                    this.push(bodyContent);
                    this.done = true;
                }
            }
        })(new Socket());
    }

    header(name: string, value: string | number): this {
        this.headers[name] = String(value);
        return this;
    }

    json(body: object): this {
        this.contentBuffer = Buffer.from(JSON.stringify(body), 'utf8');
        this.headers['Content-Type'] = 'application/json';
        this.headers['Content-Length'] = String(this.contentBuffer.byteLength);
        return this;
    }

    body(body: string | Buffer): this {
        if ('string' === typeof body) {
            this.contentBuffer = Buffer.from(body, 'utf8');
        } else {
            this.contentBuffer = body;
        }
        this.headers['Content-Length'] = String(this.contentBuffer.byteLength);
        return this;
    }

    query(query: any): this {
        this.queryPath = querystring.stringify(query);
        return this;
    }
}

export class HttpRequest extends IncomingMessage {
    /**
     * A store that can be used to transport data from guards/listeners to ParameterResolvers/controllers.
     */
    public store: { [name: string]: any } = {};

    public uploadedFiles: { [name: string]: UploadedFile } = {};

    static GET(path: string): RequestBuilder {
        return new RequestBuilder(path);
    }

    static POST(path: string): RequestBuilder {
        return new RequestBuilder(path, 'POST');
    }

    static PUT(path: string): RequestBuilder {
        return new RequestBuilder(path, 'PUT');
    }

    static DELETE(path: string): RequestBuilder {
        return new RequestBuilder(path, 'DELETE');
    }

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
