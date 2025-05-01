import { register } from 'node:module';

// @ts-ignore
register('./hooks.js', import.meta.url);
