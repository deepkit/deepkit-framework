import { httpWorkflow } from './http';
import { config } from './module.config';
import { AppModule } from '@deepkit/app';

export const HttpModule = new AppModule({
    config: config,
    workflows: [
        httpWorkflow
    ],
}, 'http').forRoot();
