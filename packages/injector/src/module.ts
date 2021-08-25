import { ClassType, getClassName } from '@deepkit/core';
import { ConfiguredProviderRegistry, ConfigureProvider } from './injector';
import { setupProvider } from './injector-context';

let moduleIds: number = 0;

export class InjectorModule<N extends string = string, C extends { [name: string]: any } = any> {
    protected contextId: number = -1;
    protected setupProviderRegistry = new ConfiguredProviderRegistry;

    constructor(
        public name: N,
        public config: C,
        public id: number = moduleIds++,
    ) {
    }

    setContextId(id: number) {
        this.contextId = id;
    }

    hasContextId(): boolean {
        return this.contextId !== -1;
    }

    getContextId(): number {
        if (this.contextId === -1) {
            throw new Error(`Requested context id of module ${getClassName(this.constructor)} but it was nowhere imported. Make sure you referenced the correct module instance.`);
        }
        return this.contextId;
    }

    getName(): N {
        return this.name;
    }

    getConfig(): C {
        return this.config;
    }

    setConfig(config: C) {
        this.config = config;
    }

    getConfiguredProviderRegistry(): ConfiguredProviderRegistry {
        return this.setupProviderRegistry;
    }

    /**
     * Returns a configuration object that reflects the API of the given ClassType or token. Each call
     * is scheduled and executed once the provider has been created by the dependency injection container.
     */
    setupProvider<T extends ClassType<T> | any>(classTypeOrToken: T, order: number = 0): ConfigureProvider<T extends ClassType<infer C> ? C : T> {
        return setupProvider(classTypeOrToken, this.setupProviderRegistry, order);
    }
}
