import 'reflect-metadata';
import {Provider} from "injection-js";
import {Application} from "./application";
import {ClassType} from "@marcj/estdlib";
import {ApplicationServerConfig} from "./application-server";

export interface ApplicationDecoratorOptions {
    config: ApplicationServerConfig | Partial<ApplicationServerConfig>,
    serverProviders: Provider[],
    connectionProviders: Provider[],
    controllers: ClassType<any>[];
    entitiesForTypeOrm: ClassType<any>[];
    notifyEntities: ClassType<any>[];
}

export interface ControllerOptions {
    name: string;
}

export function ApplicationModule<T extends Application>(config: Partial<ApplicationDecoratorOptions>) {
    return (target: ClassType<T>) => {
        Reflect.defineMetadata('glut:module', config, target);
    };
}

export function getApplicationModuleOptions<T extends Application>(target: ClassType<T>): Partial<ApplicationDecoratorOptions> {
    return Reflect.getMetadata('glut:module', target) || {};
}

export function getControllerOptions<T>(target: ClassType<T>): ControllerOptions | undefined {
    return Reflect.getMetadata('glut:controller', target);
}
