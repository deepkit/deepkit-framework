/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { App, AppModule, RootModuleDefinition } from '@deepkit/app';
import { FrameworkModule } from './module';

/**
 * This is the main application class for a Deepkit Framework Application.
 *
 * It extends his brother `App` (from @deepkit/app).
 *
 * This class registers the FrameworkModule, if not manually imported.
 * The FrameworkModule brings the actual framework features:
 *    - It loads automatically the debugger interface when debug configuration is true.
 *    - It registers all Database migration CLI commands
 *    - It detects database classes automatically and makes them available in the migration CLI tools + the ORM Browser.
 *    - It has multi-process worker abstraction
 *    - Profiler
 *    - Broker and AppLocker (needs broker.startOnBootstrap configuration to be true to start automatically)
 *    - Various CLI tools to start and debug the application
 *
 *  Beside from that, it works exactly like the slightly smaller version `App`.
 */
export class Application<T extends RootModuleDefinition> extends App<T> {
    constructor(
        appModuleOptions: T,
        appModule?: AppModule<any>
    ) {
        const module = appModule || new AppModule(appModuleOptions) as any;
        if (!module.hasImport(FrameworkModule)) {
            module.imports.unshift(new FrameworkModule);
        }
        super(appModuleOptions, undefined, module);
    }

    static fromModule<T extends RootModuleDefinition>(module: AppModule<T>): Application<T> {
        return new Application({}, module) as Application<T>;
    }
}
