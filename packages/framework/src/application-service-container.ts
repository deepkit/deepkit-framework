/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AppModule, isProvided, ModuleOptions, ServiceContainer } from '@deepkit/app';
import { injectorReference, ProviderWithScope, TagProvider } from '@deepkit/injector';
import { ClassType, isClass, isPrototypeOfBase } from '@deepkit/core';
import { rpcClass } from '@deepkit/rpc';
import { httpClass, HttpControllers } from '@deepkit/http';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { kernelConfig } from './kernel.config';
import { Stopwatch } from '@deepkit/stopwatch';

export type RpcController = {
    onDestroy?: () => Promise<void>;
    onInit?: () => Promise<void>;
}

export class RpcControllers {
    public readonly controllers = new Map<string, {controller: ClassType, module: AppModule<any, any>}>();
}

export class ApplicationServiceContainer<C extends ModuleOptions = ModuleOptions> extends ServiceContainer<C> {
    public readonly rpcControllers = new RpcControllers;
    public readonly httpControllers = new HttpControllers([]);
    protected dbs: ClassType[] = [];

    public process() {
        if (this.rootContext) return ;

        this.providers.push({ provide: HttpControllers, useValue: this.httpControllers });
        this.providers.push({ provide: RpcControllers, useValue: this.rpcControllers });
        this.providers.push({ provide: ApplicationServiceContainer, useValue: this });

        super.process();
        this.setupDatabase();
    }

    protected setupDatabase() {
        for (const db of this.dbs) {
            this.rootInjectorContext.setupProvider(DatabaseRegistry).addDatabase(db);
        }

        const modules = this.getModulesForName('kernel');
        if (!modules.length) return;

        const config = modules[0].getConfig() as typeof kernelConfig.type;
        if (config.debug && config.debugProfiler) {
            for (const db of this.dbs) {
                this.rootInjectorContext.setupProvider(db).stopwatch = injectorReference(Stopwatch);
            }
        }
    }

    protected handleProviders(module: AppModule<any, any>, providers: ProviderWithScope[]) {
        for (const provider of providers) {
            if (provider instanceof TagProvider) continue;
            const provide = isClass(provider) ? provider : provider.provide;
            if (!isClass(provide)) continue;
            if (isPrototypeOfBase(provide, Database)) {
                this.dbs.push(provide);
            }
        }
    }

    protected setupController(providers: ProviderWithScope[], controller: ClassType, module: AppModule<any>) {
        const rpcConfig = rpcClass._fetch(controller);
        if (rpcConfig) {
            if (!isProvided(providers, controller)) providers.unshift({ provide: controller, scope: 'rpc' });
            this.rpcControllers.controllers.set(rpcConfig.getPath(), {controller, module});
        }

        const httpConfig = httpClass._fetch(controller);
        if (httpConfig) {
            console.log('registerController', module.getContextId());
            if (!isProvided(providers, controller)) providers.unshift({ provide: controller, scope: 'http' });
            this.httpControllers.add(controller, module);
        }

        super.setupController(providers, controller, module);
    }
}
