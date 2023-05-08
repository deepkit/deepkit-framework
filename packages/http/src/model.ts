/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { IncomingMessage, OutgoingHttpHeader, OutgoingHttpHeaders, ServerResponse } from 'http';
import { UploadedFile } from './router.js';
import * as querystring from 'querystring';
import { Writable } from 'stream';
import { metaAnnotation, ReflectionKind, Type, ValidationErrorItem } from '@deepkit/type';
import { asyncOperation, isArray } from '@deepkit/core';

export class HttpResponse extends ServerResponse {
    status(code: number) {
        this.writeHead(code);
        this.end();
    }
}

/**
 * Reads the body of the request and returns it as a Buffer.
 * The result will be cached in the request object as `request.body`.
 *
 * Deepkit's router will automatically use `request.body` if available.
 */
export function readBody(request: IncomingMessage): Promise<Buffer> {
    return asyncOperation((resolve, reject) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        request.on('end', () => {
            const body = Buffer.concat(chunks);
            //the router uses this now instead of trying to read the body again
            (request as HttpRequest).body = body;
            resolve(body);
        });
        request.on('error', (error: Error) => {
            reject(error);
        });
    });
}

export function createRequestWithCachedBody(request: Partial<IncomingMessage>, body: Buffer): HttpRequest {
    const headers = request.headers;
    const method = request.method;
    const url = request.url;

    const writable = new Writable({
        write(chunk, encoding, callback) {
            callback();
        },
        writev(chunks, callback) {
            callback();
        }
    });
    return new (class extends HttpRequest {
        url = url;
        method = method;
        position = 0;

        headers = headers as any;

        _read(size: number) {
            if (this.complete) {
                this.push(null);
            } else {
                //in Node 18 this seems to be necessary to not trigger the abort event
                this.complete = true;
                this.push(body);
            }
        }
    })(writable as any);
}

export type HttpRequestQuery = { [name: string]: string };
export type HttpRequestResolvedParameters = { [name: string]: any };
export type HttpRequestPositionedParameters = { arguments: any[], parameters: HttpRequestResolvedParameters };

export class BodyValidationError {
    constructor(
        public readonly errors: ValidationErrorItem[] = []
    ) {
    }

    hasErrors(prefix?: string): boolean {
        return this.getErrors(prefix).length > 0;
    }

    getErrors(prefix?: string): ValidationErrorItem[] {
        if (prefix) return this.errors.filter(v => v.path.startsWith(prefix));

        return this.errors;
    }

    getErrorsForPath(path: string): ValidationErrorItem[] {
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
export type HttpPath<T, Options extends { name?: string } = {}> = T & { __meta?: ['httpPath', Options] };
export type HttpHeader<T, Options extends { name?: string } = {}> = T & { __meta?: ['httpHeader', Options] };
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
export type HttpRegExp<T, Pattern extends string | RegExp> = T & { __meta?: ['httpRegExp', Pattern] };

export function getRegExp(type: Type): string | RegExp | undefined {
    const options = metaAnnotation.getForName(type, 'httpRegExp');
    if (!options || !options[0]) return;
    if (options[0].kind === ReflectionKind.literal && 'string' === typeof options[0].literal) return options[0].literal;
    if (options[0].kind === ReflectionKind.literal && options[0].literal instanceof RegExp) return options[0].literal;
    return;
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
        return createRequestWithCachedBody({
            method: this.method,
            url: this.getUrl(),
            headers: this._headers,
        }, this.contentBuffer);
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

    multiPart(items: { name: string, file?: Uint8Array, fileName?: string, json?: any }[]): this {
        const boundary = '--------------------------' + Math.random().toString(36).substr(2, 10);
        this._headers['content-type'] = 'multipart/form-data; boundary=' + boundary;
        const parts = items.map(item => {
            if (item.file) {
                const header = Buffer.from(`--${boundary}\r
Content-Disposition: form-data; name="${item.name}"; filename="${item.fileName || 'file'}"\r
Content-Type: application/octet-stream\r
\r\n`, 'utf8');
                return Buffer.concat([header, item.file, Buffer.from('\r\n', 'utf8')]);
            } else if (item.json) {
                const header = Buffer.from(`--${boundary}\r
Content-Disposition: form-data; name="${item.name}"\r
Content-Type: application/json\r
\r\n`, 'utf8');
                return Buffer.concat([header, Buffer.from(JSON.stringify(item.json) + '\r\n', 'utf8')]);
            } else {
                throw new Error('Invalid multiPart item');
            }
        });
        parts.push(Buffer.from(`--${boundary}--`, 'utf8'));
        this.contentBuffer = Buffer.concat(parts);
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
     * The router sets the body when it was read.
     */
    public body?: Buffer;

    async readBody(): Promise<Buffer> {
        if (this.body) return this.body;
        return await readBody(this);
    }

    async readBodyText(): Promise<string> {
        return (await this.readBody()).toString('utf8');
    }

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
    public headers: { [name: string]: number | string | string[] | undefined } = Object.create(null);

    setHeader(name: string, value: number | string | ReadonlyArray<string>): this {
        this.headers[name] = value as any;
        super.setHeader(name, value);
        return this;
    }

    removeHeader(name: string) {
        delete this.headers[name];
        super.removeHeader(name);
    }

    getHeader(name: string) {
        return this.headers[name];
    }

    getHeaders(): OutgoingHttpHeaders {
        return this.headers;
    }

    writeHead(statusCode: number, headersOrReasonPhrase?: string | OutgoingHttpHeaders | OutgoingHttpHeader[], headers?: OutgoingHttpHeaders | OutgoingHttpHeader[]): this {
        headers = typeof headersOrReasonPhrase === 'string' ? headers : headersOrReasonPhrase;
        if (headers && !isArray(headers)) this.headers = headers;

        if (typeof headersOrReasonPhrase === 'string') return super.writeHead(statusCode, headersOrReasonPhrase, headers);
        return super.writeHead(statusCode, headers);
    }

    get json(): any {
        const json = this.bodyString;
        try {
            return JSON.parse(json);
        } catch (error: any) {
            throw new Error(`Could not parse JSON: ${error.message}, body: ${json}`);
        }
    }

    get text(): string {
        return this.bodyString;
    }

    get bodyString(): string {
        return this.body.toString('utf8');
    }

    write(
        chunk: any,
        encoding: any,
        callback?: any
    ): any {
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

    end(chunk: any, encoding?: any, callback?: any): any {
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
        this.emit('finish');
        return this;
    }
}
