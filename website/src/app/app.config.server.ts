import { APP_BOOTSTRAP_LISTENER, ApplicationConfig, mergeApplicationConfig, REQUEST_CONTEXT } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';
import { PageResponse } from '@app/app/page-response';
import { NavigationEnd, Router } from '@angular/router';
import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';
import { provideServerRouting, RenderMode } from '@angular/ssr';

const serverConfig: ApplicationConfig = {
    providers: [
        provideServerRendering(),
        provideServerRouting([
            {
                path: '**',
                renderMode: RenderMode.Server,
            },
        ]),
        {
            provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
            deps: [REQUEST_CONTEXT],
            useFactory(context: any) {
                // we use internally localhost:8080 for ssr requests,
                // so we need to map it to the real domain
                // return { [context?.baseUrl]: context?.publicBaseUrl || '' };
                return { [context?.baseUrl]: context?.publicBaseUrl || '' };
            },
        },
        {
            provide: APP_BOOTSTRAP_LISTENER,
            multi: true,
            deps: [Router, PageResponse],
            useFactory: (router: Router, response: PageResponse) => {
                return () => {
                    router.events.subscribe(event => {
                        //only when redirectTo was used, we redirect via response.redirect(url)
                        if (event instanceof NavigationEnd && event.url !== event.urlAfterRedirects) {
                            response.redirect(event.urlAfterRedirects);
                        }
                    });
                };
            },
        },
    ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
