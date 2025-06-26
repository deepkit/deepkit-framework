import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { AppComponent } from './app/app.component';
import { routes } from './app/routes';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRpcWebSocketClient } from '@deepkit/rpc';
import { provideApiConsoleRegistry } from './app/provider';

bootstrapApplication(AppComponent, {
    providers: [
        provideApiConsoleRegistry(),
        provideZonelessChangeDetection(),
        provideRouter(routes, withHashLocation()),
        provideMarkdown(),
        provideRpcWebSocketClient(undefined, { 4200: 8080 }),
    ],
})
    .catch(err => console.error(err));
