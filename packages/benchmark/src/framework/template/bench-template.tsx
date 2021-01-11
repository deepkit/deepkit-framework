/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
