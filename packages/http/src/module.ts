import { httpWorkflow } from './http';
import { config } from './module.config';
import { createModule } from '@deepkit/app';


export class HttpModule extends createModule({
    config: config,
    workflows: [
        httpWorkflow
    ],
}, 'http') {}
