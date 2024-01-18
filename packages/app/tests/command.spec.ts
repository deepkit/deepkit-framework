import { expect, test } from '@jest/globals';
import { App } from '../src/app.js';
import { cli, Command } from '../src/command.js';
import { ServiceContainer } from '../src/service-container.js';

@cli.controller('my')
class MyCli implements Command {
    async execute(
        host: string
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
