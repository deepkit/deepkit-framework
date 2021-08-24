/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ApplicationServiceContainer } from './application-service-container';
import { AppModule, CommandApplication, ModuleOptions } from '@deepkit/app';
import { ProviderWithScope } from '@deepkit/injector';
import { KernelModule } from './kernel';

export class Application<T extends ModuleOptions> extends CommandApplication<T> {
    constructor(
        appModule: AppModule<T, any>,
        providers: ProviderWithScope<any>[] = [],
        imports: AppModule<any, any>[] = [],
    ) {
        if (!appModule.hasImport(KernelModule)) {
            if (!appModule.options.imports) appModule.options.imports = [];
            appModule.options.imports.unshift(new KernelModule);
        }
        super(appModule, providers, imports, new ApplicationServiceContainer(appModule, providers, imports.slice(0)));
    }

    static create<T extends AppModule<any, any> | ModuleOptions>(module: T): Application<T extends AppModule<infer K> ? K : T> {
        if (module instanceof AppModule) {
            return new Application(module as any);
        } else {
            //see: https://github.com/microsoft/TypeScript/issues/13995
            const mod = module as any as ModuleOptions;
            return new Application(new AppModule(mod) as any);
        }
    }

    run(argv?: any[]): Promise<void> {
        return super.run(argv);
    }
}
