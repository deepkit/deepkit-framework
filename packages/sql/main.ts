import 'reflect-metadata';
import { CommandApplication } from '@deepkit/command';
import { appModule } from './src/app.module';

new CommandApplication(appModule).run();
