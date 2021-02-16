#!/usr/bin/env ts-node-script

import 'reflect-metadata';
import { Application, KernelModule, OrmBrowserController } from '@deepkit/framework';
import { AppModule } from '@deepkit/app';
import { isAbsolute, join } from 'path';
import { Database } from '@deepkit/orm';
import { registerStaticHttpController } from '@deepkit/http';

Database.registry = [];

for (const path of process.argv.slice(2)) {
    require(isAbsolute(path) ? path : join(process.cwd(), path));
}

for (const db of Database.registry) {
    console.log(`Found database ${db.name} with adapter ${db.adapter.getName()}`);
}

const appModule = new AppModule({
    providers: [
        {provide: OrmBrowserController, useValue: new OrmBrowserController(Database.registry)},
    ],
    controllers: [
        OrmBrowserController
    ],

    imports: [
        KernelModule.configure({
            port: 9090,
            broker: {
                startOnBootstrap: false,
            }
        })
    ]
}).setup((module, config) => {
    const localPathPrefix = __dirname.includes('orm-browser/dist') ? '../../' : './';
    const localPath = join(__dirname, localPathPrefix, 'node_modules/@deepkit/orm-browser-gui/dist/orm-browser-gui');
    registerStaticHttpController(module, '/', localPath);
});

new Application(appModule).run(['server:listen']);
