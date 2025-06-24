import { InputRegistry } from './components/inputs/registry.js';
import { loadRegistry } from './components/inputs/registry-loader.js';


export function provideApiConsoleRegistry() {
    return {
        provide: InputRegistry,
        useFactory: () => {
            const registry = new InputRegistry();
            loadRegistry(registry);
            return registry;
        }
    }
}
