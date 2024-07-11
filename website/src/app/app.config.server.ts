import { APP_BOOTSTRAP_LISTENER, ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';
import { PageResponse } from '@app/app/page-response';
import { NavigationEnd, Router } from '@angular/router';
import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';

const serverConfig: ApplicationConfig = {
    providers: [
        provideServerRendering(),
        {
            provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
            useValue: { 'http://localhost:8080': 'http://localhost:8080' },
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
