import { bootstrapApplication } from '@angular/platform-browser';
import { startCollecting } from './app/collector';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

startCollecting();

bootstrapApplication(AppComponent, appConfig)
    .catch((err) => console.error(err));
