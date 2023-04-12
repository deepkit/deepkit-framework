import { createModule, findParentPath } from '@deepkit/app';
import { OrmBrowserController } from '@deepkit/framework';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { Config } from './config.js';
import { rpc } from '@deepkit/rpc';
import { ClassType, getCurrentFileName } from '@deepkit/core';
import { InjectorContext } from '@deepkit/injector';
import { dirname } from 'path';
import { registerStaticHttpController } from '@deepkit/http';

export class OrmBrowserModule extends createModule({
    config: Config
}) {
    databases: ClassType[] = [];

    forDatabases(databases: ClassType<Database>[]): this {
        this.databases = databases;
        return this;
    }

    process() {
        const controllerName = '.deepkit/orm-browser/' + this.config.path;

        @rpc.controller(controllerName)
        class ScopedOrmBrowserController extends OrmBrowserController {
        }

        this.addController(ScopedOrmBrowserController);

        this.addProvider({
            provide: ScopedOrmBrowserController,
            useFactory: (registry: DatabaseRegistry, injectorContext: InjectorContext) => {
                return new ScopedOrmBrowserController(this.databases.length ? this.databases.map(v => injectorContext.get(v)) : registry.getDatabases());
            }
        });

        const localPath = findParentPath('node_modules/@deepkit/orm-browser-gui/dist/orm-browser-gui', dirname(getCurrentFileName()));
        if (!localPath) throw new Error('node_modules/@deepkit/orm-browser-gui not installed in ' + dirname(getCurrentFileName()));

        registerStaticHttpController(this, {
            path: this.config.path,
            localPath,
            groups: ['app-static'],
            controllerName: 'ScopedController',
            indexReplace: {
                APP_CONTROLLER_NAME: controllerName
            }
        });
    }
}
