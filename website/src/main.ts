import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PageResponseModel } from '@app/app/page-response-model';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(
    AppComponent,
    mergeApplicationConfig(appConfig, {
        providers: [{ provide: 'page-response-model', useValue: new PageResponseModel() }],
    }),
).catch(err => console.error(err));
