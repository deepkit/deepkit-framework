import { APP_BOOTSTRAP_LISTENER, ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { NavigationEnd, Router } from '@angular/router';
import { PageResponse } from '@app/app/page-response';

import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
    providers: [
        provideServerRendering(),
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
