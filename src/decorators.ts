import {Provider} from "injection-js";
import {Application} from "./application";
import {ClassType} from "@marcj/marshal";
import {ApplicationServerConfig} from "./application-server";

export interface ApplicationDecoratorOptions {
    config: ApplicationServerConfig,
    serverProviders: Provider[],
    connectionProviders: Provider[],
}

export function ApplicationModule<T extends Application>(config: Partial<ApplicationDecoratorOptions>) {
    return (target: ClassType<T>) => {
        Reflect.defineMetadata('kamille:module', target, config);
    };
}

export function getApplicationModuleOptions<T extends Application>(target: ClassType<T>): Partial<ApplicationDecoratorOptions> {
    return Reflect.getMetadata('kamille:module', target) || {};
}

export function Action<T>(name?: string) {
    return (target: ClassType<T>, property: string) => {
        name = name || property;

        const actions = Reflect.getMetadata('kamille:actions', target) || {};
        actions[name] = property;

        Reflect.defineMetadata('kamille:actions', target, actions);
    }
}

export function Role() {

}
