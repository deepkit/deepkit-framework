import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { CommandApplication } from '../src/application';
import { arg, cli, Command } from '../src/command';
import { AppModule } from '../src/module';
import { ServiceContainer } from '../src/service-container';

@cli.controller('my')
class MyCli implements Command {
    async execute(
        @arg host: string
    ) {
        return 'bar' === host ? 0 : 1;
    }
}

test('command simple', () => {
    const cliConfig = cli._fetch(MyCli);
    if (!cliConfig) throw new Error('cliConfig expected');

    expect(cliConfig.name).toBe('my');
    expect(cliConfig.getArg('host').name).toBe('host');
    expect(cliConfig.getArg('host').optional).toBe(false);
    expect(cliConfig.getArg('host').propertySchema!.type).toBe('string');
});

test('command execute', async () => {
    const myModule = new AppModule({
        controllers: [MyCli]
    });

    const app = new CommandApplication(myModule);
    const serviceContainer = app.get(ServiceContainer);
    expect(serviceContainer.cliControllers.controllers.get('my')).toBe(MyCli);

    expect(await app.execute(['my', 'bar'])).toBe(0);
});
