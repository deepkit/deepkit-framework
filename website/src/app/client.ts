import { RpcClient, RpcHttpInterface, RpcHttpResponseInterface } from '@deepkit/rpc';
import type { MainController } from '@app/server/controller/main.controller';
import { Inject, Injectable } from '@angular/core';
import { BenchmarkControllerInterface } from '@app/common/benchmark';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class ControllerClient {
    main = this.client.controller<MainController>('main');
    benchmark = this.client.controller(BenchmarkControllerInterface);

    constructor(private client: RpcClient) {
    }
}

@Injectable()
export class RpcAngularHttpAdapter implements RpcHttpInterface {
    constructor(
        private httpClient: HttpClient,
        @Inject('baseUrl') private baseUrl: string,
    ) {
        this.baseUrl = baseUrl || (typeof location !== 'undefined' ? location.origin : '');
    }

    async fetch(url: string, options: {
        headers: { [p: string]: string };
        method: string;
        body: any
    }): Promise<RpcHttpResponseInterface> {
        if (!url.startsWith('/')) url = '/' + url;
        url = this.baseUrl + url;
        const res = await this.httpClient.request(options.method, url, {
            body: options.body,
            transferCache: {

            },
            headers: options.headers,
            observe: 'response',
            responseType: 'json',
        }).toPromise();

        if (!res) throw new Error('Request failed');

        const headers: { [name: string]: string } = {};
        res.headers.keys().forEach(key => headers[key || ''] = String(res.headers.get(key)));

        return {
            status: res.status,
            headers,
            body: res.body,
        };
    }
}
