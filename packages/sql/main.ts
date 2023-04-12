#!/usr/bin/env node
import { App } from '@deepkit/app';
import { appModule } from './src/app.module.js';

App.fromModule(appModule).run();
