import { ApplicationConfig, provideExperimentalZonelessChangeDetection, REQUEST_CONTEXT } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { RpcClient, RpcHttpClientAdapter, RpcHttpHeaderNames } from '@deepkit/rpc';
import { ControllerClient, RpcAngularHttpAdapter } from '@app/app/client';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { AppMetaStack } from '@app/app/components/title';
import { PlatformHelper } from '@app/app/utils';
import { PageResponse } from '@app/app/page-response';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
    providers: [
        provideExperimentalZonelessChangeDetection(),
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
            filter: () => true,
        })),
        provideHttpClient(withFetch(), ),

        ControllerClient,
        {
            provide: 'baseUrl',
            deps: [REQUEST_CONTEXT],
            useFactory: (context: any) => {
                return context.baseUrl
            },
        },
        RpcAngularHttpAdapter,
        {
            provide: RpcClient,
            deps: [RpcAngularHttpAdapter],
            useFactory: (http: RpcAngularHttpAdapter) => new RpcClient(new RpcHttpClientAdapter('api/v1', {}, http)),
        },
    ],
};
