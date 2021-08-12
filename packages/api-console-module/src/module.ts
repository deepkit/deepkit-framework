import { AppModule, AppModuleConfig, findParentPath } from '@deepkit/app';
import { registerStaticHttpController } from '@deepkit/http';
import { t } from '@deepkit/type';
import { ApiConsoleController } from './controller';

export const config = new AppModuleConfig({
    listen: t.boolean.default(true),
    basePath: t.string.default('/api-console'),
});

export const ApiConsoleModule = new AppModule({
    config,
    controllers: [ApiConsoleController]
}).setup((module, config) => {
    if (!config.listen) return;

    const localPath = findParentPath('api-console-gui/dist/api-console-gui', __dirname + '/node_modules');
    if (!localPath) throw new Error('api-console-gui not installed');
    console.log('setup LOL');
    registerStaticHttpController(module, config.basePath, localPath);
});
