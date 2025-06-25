import { InputRegistry } from './components/inputs/registry';
import { loadRegistry } from './components/inputs/registry-loader';


export function provideApiConsoleRegistry() {
    return {
        provide: InputRegistry,
        useFactory: () => {
            const registry = new InputRegistry();
            loadRegistry(registry.registry);
            return registry;
        }
    }
}
