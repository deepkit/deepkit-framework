#!/usr/bin/env node
import { App } from '@deepkit/app';
import { appModule } from './src/app.module';

App.fromModule(appModule).run();
