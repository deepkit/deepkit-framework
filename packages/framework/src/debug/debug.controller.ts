/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Config, ConfigOption, Database, DatabaseEntity, DebugControllerInterface, Event, Route, RpcAction, RpcActionParameter, Workflow } from '@deepkit/framework-debug-api';
import { rpc, rpcClass } from '@deepkit/rpc';
import { getClassSchema, t } from '@deepkit/type';
import { ApplicationServiceContainer } from '../application-service-container';
import { parseRouteControllerAction, Router } from '@deepkit/http';
import { changeClass, getClassName } from '@deepkit/core';
import { EventDispatcher, isEventListenerContainerEntryService } from '@deepkit/event';
import { DatabaseAdapter, DatabaseRegistry } from '@deepkit/orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { kernelConfig } from '../kernel.config';

class DebugConfig extends kernelConfig.slice(['varPath', 'debugStorePath']) {
}

@rpc.controller(DebugControllerInterface)
export class DebugController implements DebugControllerInterface {
    constructor(
        protected serviceContainer: ApplicationServiceContainer,
        protected eventDispatcher: EventDispatcher,
        protected router: Router,
        protected config: DebugConfig,
        protected databaseRegistry: DatabaseRegistry,
        // protected liveDatabase: LiveDatabase,
    ) {
    }

    @rpc.action()
    getProfilerFrames(): Uint8Array {
        const path = join(this.config.varPath, this.config.debugStorePath);

        return readFileSync(join(path, 'frames.bin'));
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
                httpMethod: route.httpMethod,
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
                    routeD.bodySchema = parameter.property.toJSON();
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

        for (const controller of this.serviceContainer.rpcControllers.controllers.values()) {
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
}
