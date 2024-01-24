import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { Database } from '@deepkit/orm';

import { OrmBrowserModule } from './src/module.js';

export * from './src/module.js';

export function serveOrmBrowser(
    databases: Database[],
    config: {
        port?: number;
        host?: string;
    } = {},
) {
    const app = new App({
        imports: [
            new OrmBrowserModule().forDatabases(databases),
            new FrameworkModule({
                port: config.port || 9090,
                host: config.host || 'localhost',
            }),
        ],
    });

    return app.run(['server:start']);
}
