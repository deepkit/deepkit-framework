import { createModuleClass, findParentPath } from '@deepkit/app';
import { OrmBrowserController } from '@deepkit/framework';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { Config } from './config.js';
import { rpc } from '@deepkit/rpc';
import { getCurrentFileName } from '@deepkit/core';
import { InjectorContext } from '@deepkit/injector';
import { dirname } from 'path';
import { registerStaticHttpController } from '@deepkit/http';

export class OrmBrowserModule extends createModuleClass({
    config: Config
}) {
    databases: Database[] = [];

    forDatabases(databases: Database[]): this {
        this.databases = databases;
        return this;
    }

    process() {
        const controllerName = '.deepkit/orm-browser/' + this.config.path;


        @rpc.controller(controllerName)
        // @ts-ignore
        class ScopedOrmBrowserController extends OrmBrowserController {
        }

        this.addController(ScopedOrmBrowserController);

        this.addProvider({
            provide: ScopedOrmBrowserController,
            useFactory: (registry: DatabaseRegistry, injectorContext: InjectorContext) => {
                return new ScopedOrmBrowserController(this.databases);
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
