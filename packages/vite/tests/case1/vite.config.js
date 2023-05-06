import {defineConfig} from 'vite';
import {deepkitType} from '../../dist/esm/index.js';

export default defineConfig({
    plugins: [deepkitType()],

    build: {
        "modulePreload": false,
        minify: false,
        target: "esnext",
        rollupOptions: {
            "preserveEntrySignatures": "strict",

            "output": {

                "preserveModules": true,
                "esModule": true,
                "format": "esm",

            },
            "input": {
                "xxx": "./mod.ts"
            }
        }
    },
});
