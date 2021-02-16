#!/usr/bin/env node
import 'reflect-metadata';
import { CommandApplication } from '@deepkit/app';
import { appModule } from './src/app.module';

new CommandApplication(appModule).run();
