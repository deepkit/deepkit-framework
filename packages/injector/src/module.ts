import { ClassType } from '@deepkit/core';
import { ConfiguredProviderRegistry, ConfigureProvider, setupProvider } from './injector';

export class InjectorModule<N extends string = string, C extends { [name: string]: any } = any> {
    protected setupProviderRegistry = new ConfiguredProviderRegistry;

    constructor(
        public name: N,
        public config: C,
    ) {
    }

    getName(): N {
        return this.name;
    }

    getConfig(): C {
        return this.config;
    }

    setConfig(config: C) {
        Object.assign(this.config, config);
    }

    getConfiguredProviderRegistry(): ConfiguredProviderRegistry {
        return this.setupProviderRegistry;
    }

    /**
     * Returns a configuration object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider has been created by the dependency injection container.
     */
    setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(classTypeOrToken, this.setupProviderRegistry);
    }
}
