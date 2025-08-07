import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { RpcClient, RpcHttpClientAdapter, RpcHttpHeaderNames } from '@deepkit/rpc';
import { APIInterceptor, ControllerClient, RpcAngularHttpAdapter } from '@app/app/client';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { AppMetaStack } from '@app/app/components/title';
import { PlatformHelper } from '@app/app/utils';
import { PageResponse } from '@app/app/page-response';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideLocalStorageImpl } from 'ngxtension/inject-local-storage';

class InMemoryLocalStorage implements Storage {
    values = new Map<string, string>();

    get length(): number {
        return this.values.size;
    }

    clear(): void {
        this.values.clear();
    }

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
        const keys = Array.from(this.values.keys());
        return keys[index] ?? null;
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        AppMetaStack,
        PageResponse,
        PlatformHelper,
        provideRouter(routes, withInMemoryScrolling({
            anchorScrolling: 'enabled',
            scrollPositionRestoration: 'enabled',
        })),
        provideClientHydration(withHttpTransferCacheOptions({
            includeHeaders: RpcHttpHeaderNames,
            includePostRequests: true,
        })),
        provideHttpClient(withFetch(), withInterceptorsFromDi()),
        {
            provide: HTTP_INTERCEPTORS,
            useClass: APIInterceptor,
            multi: true,
        },
        ControllerClient,
        RpcAngularHttpAdapter,
        provideLocalStorageImpl(typeof localStorage === 'undefined' ? new InMemoryLocalStorage : localStorage),
        {
            provide: RpcClient,
            deps: [RpcAngularHttpAdapter],
            useFactory: (http: RpcAngularHttpAdapter) => new RpcClient(new RpcHttpClientAdapter('api/v1', {}, http)),
        },
    ],
};
