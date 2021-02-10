import 'reflect-metadata';
import { BrowserController } from './src/controller';
import { isAbsolute, join } from 'path';
import { Database } from '@deepkit/orm';
import { Application, KernelModule } from '@deepkit/framework';

Database.registry = [];

for (const path of process.argv.slice(2)) {
    require(isAbsolute(path) ? path : join(process.cwd(), path));
}

for (const db of Database.registry) {
    console.log(`Found database ${db.name} with adapter ${db.adapter.getName()}`);
}

Application.create({
    providers: [
        {provide: BrowserController, useValue: new BrowserController(Database.registry)},
    ],
    controllers: [
        BrowserController
    ],
    imports: [
        KernelModule.configure({
            port: 9090,
            broker: {
                startOnBootstrap: false,
            }
        })
    ]
}).run(['server:listen']);