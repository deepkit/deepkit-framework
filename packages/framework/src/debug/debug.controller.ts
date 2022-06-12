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
import { parseRouteControllerAction, HttpRouter } from '@deepkit/http';
import { changeClass, ClassType, getClassName, isClass } from '@deepkit/core';
import { EventDispatcher, isEventListenerContainerEntryService } from '@deepkit/event';
import { DatabaseAdapter, DatabaseRegistry } from '@deepkit/orm';
import { readFileSync, statSync, truncateSync } from 'fs';
import { join } from 'path';
import { FrameworkConfig } from '../module.config';
import { FileStopwatchStore } from './stopwatch/store';
import { Subject } from 'rxjs';
import { unlink } from 'fs/promises';
import { getScope, resolveToken, Token } from '@deepkit/injector';
import { AppModule, ServiceContainer } from '@deepkit/app';
import { RpcControllers } from '../rpc';
import { ReflectionClass, serializeType, stringifyType } from '@deepkit/type';

@rpc.controller(DebugControllerInterface)
export class DebugController implements DebugControllerInterface {
    protected reservedTokenIds = new Map<Token, number>();
    protected idToTokenMap = new Map<number, Token>();

    constructor(
        protected serviceContainer: ServiceContainer,
        protected eventDispatcher: EventDispatcher,
        protected router: HttpRouter,
        protected config: Pick<FrameworkConfig, 'varPath' | 'debugStorePath'>,
        protected rpcControllers: RpcControllers,
        protected databaseRegistry: DatabaseRegistry,
        protected stopwatchStore?: FileStopwatchStore,
        // protected liveDatabase: LiveDatabase,
    ) {
    }

    @rpc.action()
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
    databases(): Database[] {
        if (!this.databaseRegistry) return [];

        const databases: Database[] = [];

        for (const db of this.databaseRegistry.getDatabases()) {
            const entities: DatabaseEntity[] = [];
            for (const classSchema of db.entityRegistry.entities) {
                entities.push({ name: classSchema.name, className: classSchema.getClassName() });
            }
            databases.push({ name: db.name, entities, adapter: (db.adapter as DatabaseAdapter).getName() });
        }

        return databases;
    }

    @rpc.action()
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
    routes(): Route[] {
        const routes: Route[] = [];

        for (const route of this.router.getRoutes()) {
            const routeD: Route = {
                path: route.getFullPath(),
                httpMethods: route.httpMethods,
                parameters: [],
                groups: route.groups,
                category: route.category,
                controller: route.action.type === 'controller' ? getClassName(route.action.controller) + '.' + route.action.methodName : route.action.fn.name,
                description: route.description,
            };
            const parsedRoute = parseRouteControllerAction(route);

            const queryParameters: string[] = [];
            for (const parameter of parsedRoute.getParameters()) {
                if (parameter.body || parameter.bodyValidation) {
                    routeD.bodyType = stringifyType(parameter.getType());
                } else if (parameter.query) {
                    routeD.parameters.push({
                        name: parameter.getName(),
                        type: 'query',
                        stringType: stringifyType(parameter.parameter.parameter),
                    });
                    queryParameters.push(`${parameter.getName()}=TODO`);
                    // queryParameters.push(`${parameter.getName()}=${stringifyType(parameter.parameter.type)}`);
                } else if (parameter.isPartOfPath()) {
                    routeD.parameters.push({
                        name: parameter.getName(),
                        type: 'url',
                        stringType: stringifyType(parameter.parameter.parameter),
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

        if (this.serviceContainer.appModule.configDefinition) {
            const schema = ReflectionClass.from(this.serviceContainer.appModule.configDefinition);
            for (const [name, value] of Object.entries(this.serviceContainer.appModule.getConfig())) {
                const property = schema.getProperty(name);
                appConfig.push({
                    name: name,
                    value: value,
                    defaultValue: property.getDefaultValue(),
                    description: property.getDescription(),
                    type: stringifyType(property.property),
                });
            }
        }

        const modulesConfig: ConfigOption[] = [];

        for (const module of this.serviceContainer.appModule.getImports()) {
            if (!module.configDefinition) continue;

            const schema = ReflectionClass.from(module.configDefinition);
            for (const [name, value] of Object.entries(module.getConfig())) {
                const property = schema.getProperty(name);
                modulesConfig.push({
                    name: module.getName() + '.' + name,
                    value: value,
                    defaultValue: property.getDefaultValue(),
                    description: property.getDescription(),
                    type: stringifyType(property.property),
                });
            }
        }

        return changeClass({
            appConfig, modulesConfig,
        }, Config);
    }

    @rpc.action()
    actions(): RpcAction[] {
        const result: RpcAction[] = [];

        for (const { controller } of this.rpcControllers.controllers.values()) {
            const rpcConfig = rpcClass._fetch(controller);
            if (!rpcConfig) continue;

            for (const action of rpcConfig.actions.values()) {
                const parameters: RpcActionParameter[] = [];
                for (const parameter of ReflectionClass.from(controller).getMethodParameters(action.name || '')) {
                    parameters.push(new RpcActionParameter(parameter.name, stringifyType(parameter.parameter)));
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
    // httpRequests(): Promise<Collection<DebugRequest>> {
    //     return this.liveDatabase.query(DebugRequest).find();
    // }

    @rpc.action()
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

            return String(token);
        }

        function extract(module: AppModule<any>): ModuleApi {
            const moduleApi = new ModuleApi(module.name, module.id, getClassName(module));
            moduleApi.config = module.getConfig();
            if (module.configDefinition) {
                moduleApi.configSchemas = serializeType(ReflectionClass.from(module.configDefinition).type);
            }

            for (const provider of module.getProviders()) {
                const token = resolveToken(provider);
                const service = new ModuleService(getTokenId(token), getTokenLabel(token));
                service.scope = getScope(provider);
                service.instantiations = injectorContext.instantiationCount(token, module, service.scope);

                if (isClass(token) && module.controllers.includes(token as ClassType)) {
                    service.type = 'controller';
                } else if (isClass(token) && module.listeners.includes(token as ClassType)) {
                    service.type = 'listener';
                }

                moduleApi.services.push(service);

                service.exported = module.isExported(token);
                service.forRoot = module.root;
            }

            const builtPreparedProviders = module.getBuiltPreparedProviders();
            if (builtPreparedProviders) {
                for (const preparedProvider of builtPreparedProviders) {
                    const token = preparedProvider.token;
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
