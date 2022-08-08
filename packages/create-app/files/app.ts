#!/usr/bin/env -S node -r ts-node/register/transpile-only
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { Logger, JSONTransport } from '@deepkit/logger';

import { HelloWorldControllerCli } from './src/controller/hello-world.cli.js';
import { HelloWorldControllerHttp } from './src/controller/hello-world.http.js';
import { HelloWorldControllerRpc } from './src/controller/hello-world.rpc.js';
import { Service } from './src/app/service.js';
import { AppConfig } from './src/app/config.js';

new App({
    config: AppConfig,
    controllers: [
        HelloWorldControllerCli,
        HelloWorldControllerHttp,
        HelloWorldControllerRpc,
    ],
    providers: [
        Service,
    ],
    imports: [new FrameworkModule({ debug: true })]
})
    .loadConfigFromEnv({ envFilePath: ['production.env', '.env'] })
    .setup((module, config: AppConfig) => {
        if (config.environment === 'production') {
            //enable logging JSON messages instead of formatted strings
            module.setupGlobalProvider<Logger>().setTransport([new JSONTransport]);

            //disable debugging
            module.getImportedModuleByClass(FrameworkModule).configure({debug: false});
        }
    })
    .run();
