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
import { metaAnnotation, ReflectionKind, Type, ValidationFailedItem } from '@deepkit/type';

export class HttpResponse extends ServerResponse {
    status(code: number) {
        this.writeHead(code);
        this.end();
    }
}

export type HttpRequestQuery = { [name: string]: string };
export type HttpRequestResolvedParameters = { [name: string]: any };

export class BodyValidationError {
    constructor(
        public readonly errors: ValidationFailedItem[] = []
    ) {
    }

    hasErrors(prefix?: string): boolean {
        return this.getErrors(prefix).length > 0;
    }

    getErrors(prefix?: string): ValidationFailedItem[] {
        if (prefix) return this.errors.filter(v => v.path.startsWith(prefix));

        return this.errors;
    }

    getErrorsForPath(path: string): ValidationFailedItem[] {
        return this.errors.filter(v => v.path === path);
    }

    getErrorMessageForPath(path: string): string {
        return this.getErrorsForPath(path).map(v => v.message).join(', ');
    }
}

export class ValidatedBody<T> {
    constructor(public error: BodyValidationError, public value?: T) {
    }

    valid(): this is { value: T } {
        return this.value !== undefined;
    }
}

export type HttpBody<T> = T & { __meta?: ['httpBody'] };
export type HttpBodyValidation<T> = ValidatedBody<T> & { __meta?: ['httpBodyValidation'] };
export type HttpQuery<T, Options extends { name?: string } = {}> = T & { __meta?: ['httpQuery', Options] };
export type HttpQueries<T, Options extends { name?: string } = {}> = T & { __meta?: ['httpQueries', Options] };

/**
 * For all parameters used in the URL path, a regular expression of /[^/]+/ is used. To change that, use getRegExp.
 *
 * @example
 * ```typescript
 *
 * class Controller {
 *     @http.GET('/user/:username')
 *     route(username: HttpRegExp<string, '.*'>) {
 *         //username is string
 *     }
 * }
 * ```
 */
export type HttpRegExp<T, Pattern extends string> = T & { __meta?: ['httpRegExp', Pattern] };

export function getRegExp(type: Type): string | undefined {
    const options = metaAnnotation.getForName(type, 'httpRegExp');
    if (!options || !options[0]) return;
    if (options[0].kind !== ReflectionKind.literal || 'string' !== typeof options[0].literal) return;
    return options[0].literal;
}

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

    /**
     * Cache of parsed fields. If middleware prior to Deepkit populates this,
     * Deepkit will re-use it.
     */
    public body?: { [name: string]: any };

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
