import 'jest';
import 'reflect-metadata';
import {arg, cli, Command} from '../src/command';
import {Application} from '../src/application';
import {hornet} from '../src/decorator';
import {ServiceContainer} from '../src/service-container';

@cli.controller('my')
class MyCli implements Command {
    async execute(
        @arg host: string
    ) {
        return host;
    }
}

test('command simple', () => {
    const cliConfig = cli._fetch(MyCli);
    if (!cliConfig) throw new Error('cliConfig expected');

    expect(cliConfig.name).toBe('my');
    expect(cliConfig.args.host.name).toBe('host');
    expect(cliConfig.args.host.optional).toBe(false);
    expect(cliConfig.args.host.propertySchema!.type).toBe('string');
});

test('command execute', async () => {

    @hornet.module({
        controllers: [MyCli]
    })
    class MyModule {}

    const app = new Application(MyModule);
    const serviceContainer = app.get(ServiceContainer);
    expect(serviceContainer.cliControllers.get('my')).toBe(MyCli);

    expect(await app.execute(['my', 'bar'])).toBe('bar');
});