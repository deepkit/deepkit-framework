import { RpcMessage, RpcMessageRouteType } from '../protocol.js';
import { cast, ReceiveType, resolveReceiveType } from '@deepkit/type';
import { base64ToUint8Array } from '@deepkit/core';

export interface RpcHttpRequest {
    headers: { [name: string]: undefined | string | string[] };
    method?: string;
    url?: string;
    body?: Uint8Array;
}

export interface RpcHttpResponse {
    setHeader(name: string, value: number | string): this;

    writeHead(statusCode: number): this;

    end(data?: Uint8Array | string): void;
}

export class HttpRpcMessage extends RpcMessage {
    constructor(
        public id: number,
        public composite: boolean,
        public type: number,
        public routeType: RpcMessageRouteType,
        public headers: RpcHttpRequest['headers'],
        public json?: any,
    ) {
        super(id, composite, type, routeType);
    }

    getJson(): any {
        return this.json;
    }

    getSource(): Uint8Array {
        return base64ToUint8Array(String(this.headers['X-Source']));
    }

    getDestination(): Uint8Array {
        return base64ToUint8Array(String(this.headers['X-Destination']));
    }

    getError(): Error {
        return super.getError();
    }

    isError(): boolean {
        return super.isError();
    }

    parseGenericBody(): object {
        return this.getJson();
    }

    parseBody<T>(type?: ReceiveType<T>): T {
        const json = this.getJson();
        if (!json) {
            throw new Error('No body found');
        }
        return cast(json, undefined, undefined, undefined, resolveReceiveType(type));
    }

    getBodies(): RpcMessage[] {
        const json = this.getJson();
        if (!Array.isArray(json)) throw new Error('Expected array of RpcMessage items');

        const result: RpcMessage[] = [];
        for (const item of json) {
            result.push(new HttpRpcMessage(this.id, false, item.type, this.routeType, this.headers, item.body));
        }

        return result;
    }
}

// export function createHttpRpcMessage(type:
//
// }
