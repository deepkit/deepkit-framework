/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { KernelModule } from './kernel';
import { ApplicationServiceContainer } from './application-service-container';
import { CommandApplication, createModule, Module, ModuleOptions } from '@deepkit/command';
import { ProviderWithScope } from '@deepkit/injector';

export class Application<T extends ModuleOptions<any>> extends CommandApplication<T> {
    constructor(
        appModule: Module<T>,
        providers: ProviderWithScope<any>[] = [],
        imports: Module<any>[] = [],
    ) {
        if (!appModule.hasImport(KernelModule)) appModule.addImport(KernelModule);
        super(appModule, providers, imports, new ApplicationServiceContainer(appModule, providers, imports.slice(0)));
    }

    static create<T extends Module<any> | ModuleOptions<any>>(module: T): Application<T extends Module<infer K> ? K : T> {
        if (module instanceof Module) {
            return new Application(module as any);
        } else {
            //see: https://github.com/microsoft/TypeScript/issues/13995
            const mod = module as any as ModuleOptions<any>;
            return new Application(createModule(mod) as any);
        }
    }
}
