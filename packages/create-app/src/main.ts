import { App } from '@deepkit/app';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { CreateController } from './lib/controller/create.js';

new App({
    controllers: [CreateController],
    providers: [{ provide: Logger, useValue: new Logger([new ConsoleTransport]) }]
}).run(['create', ...process.argv.slice(2)]);
