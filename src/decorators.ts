import {Provider} from "injection-js";
import {Application} from "./application";
import {ClassType} from "@marcj/marshal";
import {ApplicationServerConfig} from "./application-server";

export interface ApplicationDecoratorOptions {
    config: ApplicationServerConfig,
    serverProviders: Provider[],
    connectionProviders: Provider[],
    controllers: ClassType<any>[];
}

export interface ControllerOptions {
    name: string;
}

export function ApplicationModule<T extends Application>(config: Partial<ApplicationDecoratorOptions>) {
    return (target: ClassType<T>) => {
        Reflect.defineMetadata('kamille:module', config, target);
    };
}

export function getApplicationModuleOptions<T extends Application>(target: ClassType<T>): Partial<ApplicationDecoratorOptions> {
    return Reflect.getMetadata('kamille:module', target) || {};
}

export function getControllerOptions<T>(target: ClassType<T>): ControllerOptions | undefined {
    return Reflect.getMetadata('kamille:controller', target);
}

export function Action(name?: string) {
    return (target: any, property: string) => {
        name = name || property;

        const actions = Reflect.getMetadata('kamille:actions', target) || {};
        actions[name] = property;

        Reflect.defineMetadata('kamille:actions', actions, target);
    }
}

export function Controller(name: string) {
    return (target: any) => {
        Reflect.defineMetadata('kamille:controller', {
            name: name,
        }, target);
    }
}
