#!/usr/bin/env -S node -r ts-node/register/transpile-only
import { App } from '@deepkit/app';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { CreateController } from './src/controller/create';

new App({
    controllers: [CreateController],
    providers: [{ provide: Logger, useValue: new Logger([new ConsoleTransport]) }]
}).run(['create', ...process.argv.slice(2)]);
