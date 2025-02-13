import { RpcClient, RpcHttpInterface, RpcHttpResponseInterface } from '@deepkit/rpc';
import type { MainController } from '@app/server/controller/main.controller';
import { Inject, Injectable, Optional } from '@angular/core';
import { BenchmarkControllerInterface } from '@app/common/benchmark';
import { HttpClient, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class ControllerClient {
    main = this.client.controller<MainController>('main');
    benchmark = this.client.controller(BenchmarkControllerInterface);

    constructor(private client: RpcClient) {
    }
}

@Injectable()
export class APIInterceptor implements HttpInterceptor {
    constructor(@Inject('baseUrl') @Optional() private baseUrl: string) {
        // In client build, `baseUrl` is empty and should be inferred from the current location.
        // If this is not correct, you can simply define the `baseUrl` in the `providers` array of the `appConfig` object.
        this.baseUrl = baseUrl || (typeof location !== 'undefined' ? location.origin : '');
    }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const apiReq = req.clone({ url: `${this.baseUrl}/${req.url}` });
        return next.handle(apiReq);
    }
}

@Injectable()
export class RpcAngularHttpAdapter implements RpcHttpInterface {
    constructor(
        private httpClient: HttpClient
    ) {
    }

    async fetch(url: string, options: {
        headers: { [p: string]: string };
        method: string;
        body: any
    }): Promise<RpcHttpResponseInterface> {
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
