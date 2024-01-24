import { ApplicationConfig } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { ControllerClient } from '@app/app/client';
import { AppMetaStack } from '@app/app/components/title';
import { PageResponse } from '@app/app/page-response';
import { PlatformHelper } from '@app/app/utils';
import { withZoneModule } from '@app/app/zone';

import { createRpcWebSocketClientProvider } from '@deepkit/rpc';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        AppMetaStack,
        PageResponse,
        PlatformHelper,
        provideClientHydration(),
        provideRouter(
            routes,
            withRouterConfig({}),
            withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
        ),
        withZoneModule(),
        ControllerClient,
        createRpcWebSocketClientProvider(),
    ],
};
