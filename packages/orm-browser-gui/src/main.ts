import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { AppComponent } from './app/app.component';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRpcWebSocketClient } from '@deepkit/rpc';
import { routes } from './app/routes';
import { provideOrmBrowserRegistry } from './app/provider';


bootstrapApplication(AppComponent, {
    providers: [
        provideOrmBrowserRegistry(),
        provideZonelessChangeDetection(),
        provideRouter(routes, withHashLocation()),
        provideRpcWebSocketClient(undefined, { 4200: 8080 }),
    ],
})
    .catch(err => console.error(err));
