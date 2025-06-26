import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { mergeApplicationConfig } from '@angular/core';
import { Buffer } from 'buffer';

(window as any).Buffer = Buffer;

bootstrapApplication(AppComponent, mergeApplicationConfig(appConfig, {
    providers: [],
}))
    .catch((err) => console.error(err));
