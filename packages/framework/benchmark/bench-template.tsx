import {Injector} from '../src/injector/injector';
import {bench, BenchSuite} from '@super-hornet/core';
import {render, template} from '../src/template/template';
import {Website} from './template/website';

const template1 = () => <div>Test</div>;

function Head({}, contents: string[]) {
    return <div>Yes</div>;
}

const template2 = () =>
    <Website title="Test">
        <div>Content</div>
    </Website>;

const injector = new Injector();
const benchSuite = new BenchSuite('Template');

benchSuite.add('complex ', () => {
    const t = Website({title: 'asd'}, ['']);
    render(injector, t);
    // t.render(injector);
});

benchSuite.run();

async function main() {
    // await bench(100_000, 'render simple async', async () => {
    //     const t = template1();
    //     render(injector, t);
    // });

    await bench(10_000, 'render complex async', async () => {
        const t = template2();
        await render(injector, t);
    });
}

main();

// bench(10_000, 'renderTest simple async', async () => {
//     const t = template1();
//     await renderTest(injector, t);
// });
//
// bench(10_000, 'renderTest complex async', async () => {
//     const t = template2();
//     await renderTest(injector, t);
// });
