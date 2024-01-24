/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Subject } from 'rxjs';

import { ControllerSymbol } from '@deepkit/rpc';
import { Excluded, Type, deserializeType, entity } from '@deepkit/type';

import { DebugRequest, MediaFile } from './model.js';

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
    transitions!: { from: string; to: string; label?: string }[];
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

@entity.name('.deepkit/debugger/filesystem')
export class Filesystem {
    name!: string;
    adapter!: string;
    options: { [name: string]: any } = {};
}

@entity.name('.deepkit/debugger/config')
export class Config {
    appConfig!: ConfigOption[];
    modulesConfig!: ConfigOption[];
}

export class RouteParameter {
    name!: string;
    type!: 'body' | 'query' | 'url';
    stringType!: string;
}

@entity.name('.deepkit/debugger/route')
export class Route {
    constructor(
        public path: string,
        public httpMethods: string[],
        public controller: string,
        public description: string,
        public parameters: RouteParameter[],
        public groups: string[],
        public category: string,
        public bodyType?: any,
    ) {}
}

@entity.name('.deepkit/debugger/rpc/action/parameter')
export class RpcActionParameter {
    constructor(
        public name: string,
        public type: string,
    ) {}
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
    ) {}
}

@entity.name('.deepkit/debugger/module/importedService')
export class ModuleImportedService {
    constructor(
        public id: number,
        public token: string,
        public fromModule: string,
    ) {}
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
    ) {}

    /** @reflection never */
    getConfigSchema(): Type | undefined {
        if (!this.deserializedConfigSchema && this.configSchemas) {
            this.deserializedConfigSchema = deserializeType(this.configSchemas);
        }

        return this.deserializedConfigSchema;
    }
}

export const DebugMediaInterface = ControllerSymbol<DebugMediaInterface>('.deepkit/debug/media', [MediaFile]);

export interface DebugMediaInterface {
    getPublicUrl(fs: number, path: string): Promise<string>;

    createFolder(fs: number, path: string): Promise<void>;

    getFile(fs: number, path: string): Promise<MediaFile | false>;

    getFiles(fs: number, path: string): Promise<MediaFile[]>;

    // getMediaPreview(fs: number, path: string): Promise<{ file: MediaFile, data: Uint8Array } | false>;

    getMediaQuickLook(fs: number, path: string): Promise<{ file: MediaFile; data: Uint8Array } | false>;

    getMediaData(fs: number, path: string): Promise<Uint8Array | false>;

    renameFile(fs: number, path: string, newName: string): Promise<string>;

    addFile(fs: number, name: string, dir: string, data: Uint8Array): Promise<void>;

    remove(fs: number, paths: string[]): Promise<void>;
}

export const DebugControllerInterface = ControllerSymbol<DebugControllerInterface>('.deepkit/debug/controller', [
    Config,
    Database,
    Route,
    RpcAction,
    Workflow,
    Event,
    DebugRequest,
]);

export interface DebugControllerInterface {
    configuration(): Config;

    subscribeStopwatchFrames(): Promise<Subject<Uint8Array>>;

    subscribeStopwatchFramesData(): Promise<Subject<Uint8Array>>;

    databases(): Database[];

    filesystems(): Filesystem[];

    routes(): Route[];

    modules(): ModuleApi;

    actions(): RpcAction[];

    getWorkflow(name: string): Workflow;

    getProfilerFrames(): [Uint8Array, Uint8Array, Uint8Array];

    resetProfilerFrames(): void;

    events(): Event[];

    httpRequests(): DebugRequest[];

    // httpRequests(): Promise<Collection<DebugRequest>>;
}
