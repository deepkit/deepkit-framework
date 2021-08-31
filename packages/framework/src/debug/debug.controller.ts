/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import {
    Config,
    ConfigOption,
    Database,
    DatabaseEntity,
    DebugControllerInterface,
    Event,
    ModuleApi,
    ModuleImportedService,
    ModuleService,
    Route,
    RpcAction,
    RpcActionParameter,
    Workflow
} from '@deepkit/framework-debug-api';
import { rpc, rpcClass } from '@deepkit/rpc';
import { getClassSchema, serializeSchemas, t } from '@deepkit/type';
import { parseRouteControllerAction, Router } from '@deepkit/http';
import { changeClass, getClassName, isClass } from '@deepkit/core';
import { EventDispatcher, isEventListenerContainerEntryService } from '@deepkit/event';
import { DatabaseAdapter, DatabaseRegistry } from '@deepkit/orm';
import { readFileSync, statSync, truncateSync } from 'fs';
import { join } from 'path';
import { frameworkConfig } from '../module.config';
import { FileStopwatchStore } from './stopwatch/store';
import { Subject } from 'rxjs';
import { unlink } from 'fs/promises';
import { getScope, inject, InjectorToken, resolveToken, Token } from '@deepkit/injector';
import { AppModule, ServiceContainer } from '@deepkit/app';
import { RpcControllers } from '../rpc';

class DebugConfig extends frameworkConfig.slice('varPath', 'debugStorePath') {
}

@rpc.controller(DebugControllerInterface)
export class DebugController implements DebugControllerInterface {
    protected reservedTokenIds = new Map<Token, number>();
    protected idToTokenMap = new Map<number, Token>();

    constructor(
        protected serviceContainer: ServiceContainer,
        protected eventDispatcher: EventDispatcher,
        protected router: Router,
        protected config: DebugConfig,
        protected rpcControllers: RpcControllers,
        protected databaseRegistry: DatabaseRegistry,
        @inject().optional protected stopwatchStore?: FileStopwatchStore,
        // protected liveDatabase: LiveDatabase,
    ) {
    }

    @rpc.action()
    @t.generic(t.type(Subject).generic(Uint8Array))
    async subscribeStopwatchFramesData(): Promise<Subject<Uint8Array>> {
        if (!this.stopwatchStore) throw new Error('not enabled');

        const subject = new Subject<Uint8Array>();
        const sub = await this.stopwatchStore.frameDataChannel.subscribe((v) => {
            subject.next(v);
        });
        subject.subscribe().add(() => {
            sub.unsubscribe();
        });
        return subject;
    }

    @rpc.action()
    @t.generic(t.type(Subject).generic(Uint8Array))
    async subscribeStopwatchFrames(): Promise<Subject<Uint8Array>> {
        if (!this.stopwatchStore) throw new Error('not enabled');

        const subject = new Subject<Uint8Array>();
        const sub = await this.stopwatchStore.frameChannel.subscribe((v) => {
            subject.next(v);
        });
        subject.subscribe().add(() => {
            sub.unsubscribe();
        });
        return subject;
    }

    @rpc.action()
    resetProfilerFrames(): void {
        const path = join(this.config.varPath, this.config.debugStorePath);

        unlink(join(path, 'frames.bin')).catch();
        unlink(join(path, 'frames-data.bin')).catch();
    }

    @rpc.action()
    @t.array(Uint8Array)
    getProfilerFrames(): [Uint8Array, Uint8Array] {
        const framesPath = join(this.config.varPath, this.config.debugStorePath, 'frames.bin');
        const frameDataPath = join(this.config.varPath, this.config.debugStorePath, 'frames-data.bin');
        const stat = statSync(framesPath);
        if (stat.size > 1_000_000) {
            //make sure that file is not too big
            //todo: For the moment we simply reset the files. In the future we add a index file, and allow
            // to operate on a huge file via fseek
            truncateSync(framesPath);
            truncateSync(frameDataPath);
        }

        return [readFileSync(framesPath), readFileSync(frameDataPath)];
    }

    @rpc.action()
    @t.array(Database)
    databases(): Database[] {
        if (!this.databaseRegistry) return [];

        const databases: Database[] = [];

        for (const db of this.databaseRegistry.getDatabases()) {
            const entities: DatabaseEntity[] = [];
            for (const classSchema of db.entities) {
                entities.push({ name: classSchema.name, className: classSchema.getClassName() });
            }
            databases.push({ name: db.name, entities, adapter: (db.adapter as DatabaseAdapter).getName() });
        }

        return databases;
    }

    @rpc.action()
    @t.array(Event)
    events(): Event[] {
        const events: Event[] = [];
        for (const token of this.eventDispatcher.getTokens()) {
            const listeners = this.eventDispatcher.getListeners(token);
            for (const listener of listeners) {
                if (isEventListenerContainerEntryService(listener)) {
                    events.push({
                        event: token.id,
                        controller: getClassName(listener.classType),
                        methodName: listener.methodName,
                        priority: listener.order,
                    });
                }
            }
        }
        return events;
    }

    @rpc.action()
    @t.array(Route)
    routes(): Route[] {
        const routes: Route[] = [];

        for (const route of this.router.getRoutes()) {
            const routeD: Route = {
                path: route.getFullPath(),
                httpMethods: route.httpMethods,
                parameters: [],
                groups: route.groups,
                category: route.category,
                controller: getClassName(route.action.controller) + '.' + route.action.methodName,

                description: route.description,
            };
            const parsedRoute = parseRouteControllerAction(route);

            const queryParameters: string[] = [];
            for (const parameter of parsedRoute.getParameters()) {
                if (parameter === parsedRoute.customValidationErrorHandling) continue;
                if (parameter.body) {
                    routeD.bodySchema = parameter.property.toJSONNonReference();
                } else if (parameter.query) {
                    routeD.parameters.push({
                        name: parameter.getName(),
                        type: 'query',
                        schema: parameter.property.toJSON(),
                    });
                    queryParameters.push(`${parameter.getName()}=${parameter.property.toString()}`);
                } else if (parameter.isPartOfPath()) {
                    routeD.parameters.push({
                        name: parameter.getName(),
                        type: 'url',
                        schema: parameter.property.toJSON(),
                    });
                } else {
                    //its a dependency injection token
                }
            }

            if (queryParameters.length) {
                routeD.path += '?' + queryParameters.join('&');
            }

            routes.push(routeD);
        }

        return routes;
    }

    @rpc.action()
    configuration(): Config {
        const appConfig: ConfigOption[] = [];

        if (this.serviceContainer.appModule.options.config) {
            const schema = this.serviceContainer.appModule.options.config.schema;
            for (const [name, value] of Object.entries(this.serviceContainer.appModule.getConfig())) {
                appConfig.push({
                    name: name,
                    value: value,
                    defaultValue: schema.getProperty(name).getDefaultValue(),
                    description: schema.getProperty(name).description,
                    type: schema.getProperty(name).toString(),
                });
            }
        }

        const modulesConfig: ConfigOption[] = [];

        for (const module of this.serviceContainer.appModule.getImports()) {
            if (!module.options.config) continue;

            const schema = module.options.config.schema;
            for (const [name, value] of Object.entries(module.getConfig())) {
                modulesConfig.push({
                    name: module.getName() + '.' + name,
                    value: value,
                    defaultValue: schema.getProperty(name).getDefaultValue(),
                    description: schema.getProperty(name).description,
                    type: schema.getProperty(name).toString(),
                });
            }
        }

        return changeClass({
            appConfig, modulesConfig,
        }, Config);
    }

    @rpc.action()
    @t.array(RpcAction)
    actions(@t.optional peter?: string): RpcAction[] {
        const result: RpcAction[] = [];

        for (const { controller } of this.rpcControllers.controllers.values()) {
            const rpcConfig = rpcClass._fetch(controller);
            if (!rpcConfig) continue;

            for (const action of rpcConfig.actions.values()) {
                const parameters: RpcActionParameter[] = [];
                const properties = getClassSchema(controller).getMethodProperties(action.name || '');
                for (const property of properties) {
                    parameters.push(new RpcActionParameter(property.name, property.toJSON()));
                }

                result.push({
                    path: rpcConfig.getPath(),
                    controller: getClassName(controller),
                    methodName: action.name || '',
                    parameters: parameters,
                });
            }
        }

        return result;
    }

    @rpc.action()
    getWorkflow(name: string): Workflow {
        const w = this.serviceContainer.workflowRegistry.get(name);

        return changeClass({
            places: Object.keys(w.places),
            transitions: w.transitions,
        }, Workflow);
    }

    // @rpc.action()
    // @t.generic(DebugRequest)
    // httpRequests(): Promise<Collection<DebugRequest>> {
    //     return this.liveDatabase.query(DebugRequest).find();
    // }

    @rpc.action()
    @t.type(ModuleApi)
    modules(): ModuleApi {
        const injectorContext = this.serviceContainer.getInjectorContext();

        const getTokenId = (token: Token): number => {
            const found = this.reservedTokenIds.get(token);
            if (found === undefined) {
                const id = this.reservedTokenIds.size;
                this.idToTokenMap.set(id, token);
                this.reservedTokenIds.set(token, id);
                return id;
            }
            return found;
        };

        function getTokenLabel(token: Token): string {
            if (isClass(token)) return getClassName(token);
            if (token instanceof InjectorToken) return `InjectorToken('${token.name}')`;

            return String(token);
        }

        function extract(module: AppModule<any>): ModuleApi {
            const moduleApi = new ModuleApi(module.name, module.id, getClassName(module));
            moduleApi.config = module.getConfig();
            if (module.configDefinition) {
                moduleApi.configSchemas = serializeSchemas([module.configDefinition.schema]);
            }

            for (const provider of module.getProviders()) {
                const token = resolveToken(provider);
                const service = new ModuleService(getTokenId(token), getTokenLabel(token));
                service.scope = getScope(provider);
                service.instantiations = injectorContext.instantiationCount(token, module, service.scope);

                if (isClass(token) && module.controllers.includes(token)) {
                    service.type = 'controller';
                } else if (isClass(token) && module.listeners.includes(token)) {
                    service.type = 'listener';
                }

                moduleApi.services.push(service);

                service.exported = module.isExported(token);
                service.forRoot = module.root;
            }

            const builtPreparedProviders = module.getBuiltPreparedProviders();
            if (builtPreparedProviders) {
                for (const [token, preparedProvider] of builtPreparedProviders.entries()) {
                    //We want to know which token has been imported by whom
                    if (preparedProvider.modules[0] !== module) {
                        //was imported from originally preparedProvider.modules[0]
                        moduleApi.importedServices.push(new ModuleImportedService(getTokenId(token), getTokenLabel(token), getClassName(preparedProvider.modules[0])));
                    } else if (preparedProvider.modules.length > 1) {
                        //was imported and overwritten by this module
                        moduleApi.importedServices.push(new ModuleImportedService(getTokenId(token), getTokenLabel(token), getClassName(preparedProvider.modules[1])));
                    }
                }
            }

            for (const m of module.getImports()) {
                moduleApi.imports.push(extract(m));
            }

            return moduleApi;
        }

        return extract(this.serviceContainer.appModule);
    }
}
