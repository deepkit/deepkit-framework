import { AppModule, findParentPath } from '@deepkit/app';
import { registerStaticHttpController } from '@deepkit/http';
import { ApiConsoleController } from './controller';
import { config } from './module.config';

export const ApiConsoleModule = new AppModule({
    config,
    controllers: [ApiConsoleController]
}, 'apiModule').setup((module, config) => {
    if (!config.listen) return;

    const localPath = findParentPath('node_modules/@deepkit/api-console-gui/dist/api-console-gui', __dirname);
    if (!localPath) throw new Error('node_modules/@deepkit/api-console-gui not installed in ' + __dirname);
    registerStaticHttpController(module, config.basePath, localPath, ['app-static']);
});
