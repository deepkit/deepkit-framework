/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Injector, render } from '@deepkit/framework';
import { bench } from '../../bench';
import { Website } from './website';

const template1 = () => <div>Test</div>;

function Head({ }, children: string) {
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
