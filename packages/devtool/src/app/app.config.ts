import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { RpcViewComponent } from './views/rpc.component';
import { RpcCollector } from './collector';

export const appConfig: ApplicationConfig = {
    providers: [
        RpcCollector,
        provideRouter([
            { path: '', component: RpcViewComponent },
        ], withHashLocation()),
        provideZonelessChangeDetection(),
    ],
};
