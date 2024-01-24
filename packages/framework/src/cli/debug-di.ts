/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Command, Flag, ServiceContainer, cli } from '@deepkit/app';

/**
 * @description Prints debugging information about dependency injection.
 */
@cli.controller('debug:di')
export class DebugDIController implements Command {
    constructor(protected serviceContainer: ServiceContainer) {}

    async execute(scope?: string & Flag): Promise<void> {
        const modules = [this.serviceContainer.appModule, ...this.serviceContainer.appModule.getImports()];

        let injectorContext = this.serviceContainer.getInjectorContext();

        if (scope) {
            console.log('For scope', scope);
            injectorContext = injectorContext.createChildScope(scope);
        }

        for (const module of modules) {
            console.log(`Module ${module.getName() || 'root'} DI retriever:`);
            console.log((injectorContext.getInjector(module) as any).resolver.toString());
        }
    }
}
