import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

import { TestController } from './test.controller';

void new App({
    imports: [
        new FrameworkModule({ port: 8082 }),
    ],
    controllers: [TestController]
})
    .loadConfigFromEnv({ prefix: 'NX_' })
    .run(['server:start']);
