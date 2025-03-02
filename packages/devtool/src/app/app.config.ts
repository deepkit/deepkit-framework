import { ApplicationConfig, importProvidersFrom, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { DuiAppModule, DuiWindowModule } from '@deepkit/desktop-ui';
import { RpcViewComponent } from './views/rpc.component';
import { RpcCollector } from './collector';

export const appConfig: ApplicationConfig = {
    providers: [
        RpcCollector,
        provideRouter([
            { path: '', component: RpcViewComponent },
        ], withHashLocation()),
        provideExperimentalZonelessChangeDetection(),
        importProvidersFrom(DuiAppModule.forRoot()),
        importProvidersFrom(DuiWindowModule.forRoot()),
    ],
};
