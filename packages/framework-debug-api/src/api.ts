/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ControllerSymbol } from '@deepkit/rpc';
import { DebugRequest } from './model';
import { Subject } from 'rxjs';
import { deserializeType, entity, Excluded, Type } from '@deepkit/type';

export class ConfigOption {
    name!: string;
    type!: string;
    defaultValue!: any;
    value!: any;
    description?: string;
}

@entity.name('.deepkit/debugger/workflow')
export class Workflow {
    places!: string[];
    transitions!: { from: string, to: string, label?: string; }[];
}

@entity.name('.deepkit/debugger/database/entity')
export class DatabaseEntity {
    name?: string;
    className!: string;
}

@entity.name('.deepkit/debugger/database')
export class Database {
    name!: string;
    adapter!: string;

    entities: DatabaseEntity[] = [];
}

@entity.name('.deepkit/debugger/config')
export class Config {
    appConfig!: ConfigOption[];
    modulesConfig!: ConfigOption[];
}

export class RouteParameter {
    name!: string;
    type!: 'body' | 'query' | 'url';
    schema: any;
}

@entity.name('.deepkit/debugger/route')
export class Route {
    /** @reflection never */
    public bodyPropertySchema?: Type & Excluded;

    constructor(
        public path: string,
        public httpMethods: string[],
        public controller: string,
        public description: string,
        public parameters: RouteParameter[],
        public groups: string[],
        public category: string,
        public bodySchema?: any,
    ) {
        if (bodySchema) {
            if (bodySchema.classType) {
                //we don't and can't instantiate the full PropertySchema, since the
                //type is not available at runtime.
                bodySchema.classTypeName = bodySchema.classType;
                bodySchema.classType = undefined;
            }
            this.bodyPropertySchema = deserializeType(bodySchema);
        }
    }
}

@entity.name('.deepkit/debugger/rpc/action/parameter')
export class RpcActionParameter {
    /** @reflection never */
    public propertySchema: Type & Excluded;

    constructor(
        public name: string,
        public schema: any,
    ) {
        this.propertySchema = deserializeType(schema);
    }
}

@entity.name('.deepkit/debugger/rpc/action')
export class RpcAction {
    path!: string;
    controller!: string;
    methodName!: string;
    parameters!: RpcActionParameter[];
}

@entity.name('.deepkit/debugger/rpc/event')
export class Event {
    event!: string;
    controller!: string;
    methodName!: string;
    priority!: number;
}

// @entity.name('.deepkit/debugger/module/controller')
// export class ModuleController {
//     scope: string = '';
//     exported: boolean = false;
//
//     constructor(
//         @t.name('id') public id: number,
//         @t.name('token') public token: string,
//     ) {
//     }
// }
//
// @entity.name('.deepkit/debugger/module/listener')
// export class ModuleListener {
//     scope: string = '';
//     exported: boolean = false;
//
//     constructor(
//         @t.name('id') public id: number,
//         @t.name('token') public token: string,
//     ) {
//     }
// }


@entity.name('.deepkit/debugger/module/service')
export class ModuleService {
    instantiations: number = 0;
    scope: string = '';
    exported: boolean = false;
    forRoot: boolean = false;
    type: 'service' | 'controller' | 'listener' = 'service';

    constructor(
        public id: number,
        public token: string,
    ) {
    }
}

@entity.name('.deepkit/debugger/module/importedService')
export class ModuleImportedService {
    constructor(
        public id: number,
        public token: string,
        public fromModule: string,
    ) {
    }
}

@entity.name('.deepkit/debugger/module')
export class ModuleApi {
    /** @reflection never */
    public deserializedConfigSchema?: Type & Excluded;

    public configSchemas: any;

    config: Record<string, any> = {};

    services: ModuleService[] = [];

    imports: ModuleApi[] = [];

    importedServices: ModuleImportedService[] = [];

    constructor(
        public name: string,
        public id: number,
        public className: string,
    ) {
    }

    /** @reflection never */
    getConfigSchema(): Type | undefined {
        if (!this.deserializedConfigSchema && this.configSchemas) {
            this.deserializedConfigSchema = deserializeType(this.configSchemas);
        }

        return this.deserializedConfigSchema;
    }
}

export const DebugControllerInterface = ControllerSymbol<DebugControllerInterface>('.deepkit/debug/controller', [Config, Database, Route, RpcAction, Workflow, Event, DebugRequest]);

export interface DebugControllerInterface {
    configuration(): Config;

    subscribeStopwatchFrames(): Promise<Subject<Uint8Array>>;

    subscribeStopwatchFramesData(): Promise<Subject<Uint8Array>>;

    databases(): Database[];

    routes(): Route[];

    modules(): ModuleApi;

    actions(): RpcAction[];

    getWorkflow(name: string): Workflow;

    getProfilerFrames(): [Uint8Array, Uint8Array];

    resetProfilerFrames(): void;

    events(): Event[];

    // httpRequests(): Promise<Collection<DebugRequest>>;
}
