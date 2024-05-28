import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { mergeApplicationConfig } from '@angular/core';

export { platformServer, INITIAL_CONFIG } from '@angular/platform-server';
export { CommonEngine } from '@angular/ssr';
export { Router } from '@angular/router';

export const bootstrap = (baseUrl: string) => bootstrapApplication(AppComponent, mergeApplicationConfig(config, {
    providers: [
        {
            provide: 'baseUrl',
            useValue: baseUrl,
        },
    ],
}));
