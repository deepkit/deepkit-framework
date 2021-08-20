#!/usr/bin/env node

import 'reflect-metadata';
import { Application, KernelModule } from '@deepkit/framework';
import { AppModule } from '@deepkit/app';
import { ApiConsoleModule } from '@deepkit/api-console-module';

const appModule = new AppModule({
    imports: [
        ApiConsoleModule,
        KernelModule.configure({
            port: 9080
        }),
    ]
});

new Application(appModule).loadConfigFromEnv().run(['server:start']);
