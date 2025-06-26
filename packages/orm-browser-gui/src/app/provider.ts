import { ComponentRegistry } from './registry';
import { loadRegistry } from './registry-loader';

export function provideOrmBrowserRegistry() {
    return {
        provide: ComponentRegistry,
        useFactory: () => {
            const registry = new ComponentRegistry();
            loadRegistry(registry);
            return registry;
        },
    };
}
