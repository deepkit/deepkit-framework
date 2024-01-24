import { plugin } from 'bun';

import { deepkitType } from './src/plugin.js';

export * from './src/plugin.js';

if (plugin) {
    plugin(deepkitType());
}
