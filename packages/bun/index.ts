export * from './src/plugin.js';
import { deepkitType } from './src/plugin.js';

//@ts-ignore
import { plugin } from 'bun';

if (plugin) {
    plugin(deepkitType());
}
