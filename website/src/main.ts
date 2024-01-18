import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { mergeApplicationConfig } from "@angular/core";
import { PageResponseModel } from "@app/app/page-response-model";

bootstrapApplication(AppComponent, mergeApplicationConfig(appConfig, {
    providers: [
        { provide: 'page-response-model', useValue: new PageResponseModel() }
    ]
}))
    .catch((err) => console.error(err));
