import { App } from '@deepkit/app';
import { appModule } from './lib/app.module.js';

App.fromModule(appModule).run();
