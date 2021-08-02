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
import { Context, ProviderWithScope } from '@deepkit/injector';
import { ClassType } from '@deepkit/core';
import { rpcClass } from '@deepkit/rpc';
import { httpClass, HttpControllers } from '@deepkit/http';

export type RpcController = {
    onDestroy?: () => Promise<void>;
    onInit?: () => Promise<void>;
}

export class RpcControllers {
    public readonly controllers = new Map<string, {controller: ClassType, context: Context}>();

    // public resolveController(name: string): ClassType {
    //     const classType = this.controllers.get(name);
    //     if (!classType) throw new Error(`Controller not found for ${name}`);
    //
    //     return classType;
    // }
}

export class ApplicationServiceContainer<C extends ModuleOptions = ModuleOptions> extends ServiceContainer<C> {
    public readonly rpcControllers = new RpcControllers;
    public readonly httpControllers = new HttpControllers([]);

    public process() {
        if (this.rootContext) return ;

        this.providers.push({ provide: HttpControllers, useValue: this.httpControllers });
        this.providers.push({ provide: RpcControllers, useValue: this.rpcControllers });
        this.providers.push({ provide: ApplicationServiceContainer, useValue: this });

        return super.process();
    }

    protected setupController(providers: ProviderWithScope[], controller: ClassType, context: Context, module: AppModule<any>) {
        const rpcConfig = rpcClass._fetch(controller);
        if (rpcConfig) {
            if (!isProvided(providers, controller)) providers.unshift({ provide: controller, scope: 'rpc' });
            this.rpcControllers.controllers.set(rpcConfig.getPath(), {controller, context});
        }

        const httpConfig = httpClass._fetch(controller);
        if (httpConfig) {
            if (!isProvided(providers, controller)) providers.unshift({ provide: controller, scope: 'http' });
            // (controller as any)[InjectorContext.contextSymbol] = context;
            //todo, move context to controller info
            this.httpControllers.add(controller, context.id, module);
        }

        super.setupController(providers, controller, context, module);
    }
}
