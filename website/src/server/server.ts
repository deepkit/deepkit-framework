import { app } from './app';
import { RequestHandler } from '@deepkit/angular-ssr';
import { AngularNodeAppEngine } from '@angular/ssr/node';

const ngApp = new AngularNodeAppEngine();

export const reqHandler = app.get(RequestHandler).create(import.meta.url, ngApp);
