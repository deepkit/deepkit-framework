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
import * as querystring from 'querystring';
import { Writable } from 'stream';

export class HttpResponse extends ServerResponse {
    status(code: number) {
        this.writeHead(code);
        this.end();
    }
}

export type HttpRequestQuery = { [name: string]: string };
export type HttpRequestResolvedParameters = { [name: string]: any };

export type HttpBody<T> = T & { __meta?: ['httpBody'] };
export type HttpQuery<T, Options extends {name?: string} = {}> = T & { __meta?: ['httpQuery', Options] };
export type HttpQueries<T, Options extends {name?: string} = {}> = T & { __meta?: ['httpQueries', Options] };

export class RequestBuilder {
    protected contentBuffer: Buffer = Buffer.alloc(0);
    protected _headers: { [name: string]: string } = {};
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
        const headers = this._headers;
        const method = this.method;
        const url = this.getUrl();
        const bodyContent = this.contentBuffer;

        const writable = new Writable({
            write(chunk, encoding, callback) {
                -
                    callback();
            },
            writev(chunks, callback) {
                callback();
            }
        });
        const request = new (class extends HttpRequest {
            url = url;
            method = method;
            position = 0;

            headers = headers;

            done = false;

            _read(size: number) {
                if (!this.done) {
                    this.push(bodyContent);
                    process.nextTick(() => {
                        this.emit('end');
                    });
                    this.done = true;
                }
            }
        })(writable as any);
        return request;
    }

    headers(headers: { [name: string]: string }): this {
        this._headers = headers;
        return this;
    }

    header(name: string, value: string | number): this {
        this._headers[name] = String(value);
        return this;
    }

    json(body: object): this {
        this.contentBuffer = Buffer.from(JSON.stringify(body), 'utf8');
        this._headers['content-type'] = 'application/json; charset=utf-8';
        this._headers['content-length'] = String(this.contentBuffer.byteLength);
        return this;
    }

    body(body: string | Buffer): this {
        if ('string' === typeof body) {
            this.contentBuffer = Buffer.from(body, 'utf8');
        } else {
            this.contentBuffer = body;
        }
        this._headers['content-length'] = String(this.contentBuffer.byteLength);
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

    static OPTIONS(path: string): RequestBuilder {
        return new RequestBuilder(path, 'OPTIONS');
    }

    static TRACE(path: string): RequestBuilder {
        return new RequestBuilder(path, 'TRACE');
    }

    static HEAD(path: string): RequestBuilder {
        return new RequestBuilder(path, 'HEAD');
    }

    static PATCH(path: string): RequestBuilder {
        return new RequestBuilder(path, 'PATCH');
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
        return this.socket.remoteAddress || '';
    }
}

export class MemoryHttpResponse extends HttpResponse {
    public body: Buffer = Buffer.alloc(0);

    get json(): any {
        const json = this.bodyString;
        try {
            return JSON.parse(json);
        } catch (error: any) {
            throw new Error(`Could not parse JSON: ${error.message}, body: ${json}`);
        }
    }

    get bodyString(): string {
        return this.body.toString('utf8');
    }

    write(
        chunk: any,
        encoding: any,
        callback?: any
    ): boolean {
        if (typeof encoding === 'function') {
            callback = encoding;
            encoding = null;
        }

        if (chunk) {
            if ('string' === typeof chunk) {
                chunk = Buffer.from(chunk, encoding || 'utf8');
            }
            this.body = Buffer.concat([this.body, chunk]);
        }

        if (callback) callback();
        return true;
    }

    end(chunk: any, encoding?: any, callback?: any): void {
        if (typeof chunk === 'function') {
            callback = chunk;
            chunk = null;
            encoding = null;
        } else if (typeof encoding === 'function') {
            callback = encoding;
            encoding = null;
        }

        if (chunk) {
            if ('string' === typeof chunk) {
                chunk = Buffer.from(chunk, encoding || 'utf8');
            }
            this.body = Buffer.concat([this.body, chunk]);
        }
        super.end(chunk, encoding, callback);
        // if (callback) callback();
    }
}
