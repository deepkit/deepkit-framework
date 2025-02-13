import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { mergeApplicationConfig } from '@angular/core';

bootstrapApplication(AppComponent, mergeApplicationConfig(appConfig, {
    providers: [
    ]
}))
    .catch((err) => console.error(err));
