import { createModule } from '@deepkit/command';
import { httpWorkflow } from './http';
import { config } from './module.config';

export const HttpModule = createModule({
    name: 'http',
    config: config,
    workflows: [
        httpWorkflow
    ],
}).forRoot();
