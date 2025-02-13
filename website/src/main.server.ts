import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { mergeApplicationConfig } from '@angular/core';

export { platformServer } from '@angular/platform-server';
export { Router } from '@angular/router';

export const bootstrap = () => {
    return bootstrapApplication(AppComponent, mergeApplicationConfig(config, {
        providers: [
            { provide: 'baseUrl', useValue: (global as any).baseUrl || '' },
        ],
    }));
};

export default bootstrap;
