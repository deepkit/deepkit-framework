import {Injector} from '../src/injector/injector';
import {bench} from '@deepkit/core';
import {render} from '../src/template/template';
import {Website} from './template/website';

const template1 = () => <div>Test</div>;

function Head({}, children: string) {
    return <div>Yes {children}</div>;
}

const template2 = () =>
    <Website title="Test">
        <Head>Nix</Head>
        <div>Content</div>
    </Website>;

const injector = new Injector();

async function main() {
    await bench(100_000, 'render simple async', async () => {
        const t = template1();
        await render(injector, t);
    });

    await bench(100_000, 'render complex async', async () => {
        const t = template2();
        await render(injector, t);
    });
}

main();
