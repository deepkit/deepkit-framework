import {ClassType, retrieveMetaData} from "@super-hornet/core";

export interface ControllerOptions {
    name: string;
}

export function getControllerOptions<T>(target: ClassType<T>): ControllerOptions | undefined {
    return retrieveMetaData('super-hornet:controller', target);
}
