import { createModule, findParentPath } from '@deepkit/app';
import { registerStaticHttpController } from '@deepkit/http';
import { ApiConsoleController } from './controller';
import { config } from './module.config';
import { ClassType } from '@deepkit/core';

export class ApiConsoleModule extends createModule({
    config,
    controllers: [ApiConsoleController]
}, 'apiConsole') {

    forController(...controller: ClassType[]) {
        // this.config.
    }

    process() {
        if (!this.config.listen) return;

        const localPath = findParentPath('node_modules/@deepkit/api-console-gui/dist/api-console-gui', __dirname);
        if (!localPath) throw new Error('node_modules/@deepkit/api-console-gui not installed in ' + __dirname);
        registerStaticHttpController(this, this.config.path, localPath, ['app-static']);
    }
}
