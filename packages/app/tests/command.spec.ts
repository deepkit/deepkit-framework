import { expect, test } from '@jest/globals';
import { App } from '../src/app';
import { arg, cli, Command } from '../src/command';
import { ServiceContainer } from '../src/service-container';

@cli.controller('my')
class MyCli implements Command {
    async execute(
        @arg host: string
    ) {
        return 'bar' === host ? 0 : 1;
    }
}

test('command execute', async () => {
    const app = new App({
        controllers: [MyCli]
    });
    const serviceContainer = app.get(ServiceContainer);
    expect(serviceContainer.cliControllerRegistry.controllers.get('my')!.controller).toBe(MyCli);

    expect(await app.execute(['my', 'bar'])).toBe(0);
});
