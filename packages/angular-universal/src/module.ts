import { createModule } from '@deepkit/framework';
import { AngularUniversalListener } from './listener';
import { config } from './config';

export const AngularUniversalModule = createModule({
    name: 'angular-universal',
    config: config,
    listeners: [
        AngularUniversalListener
    ]
}).forRoot();
