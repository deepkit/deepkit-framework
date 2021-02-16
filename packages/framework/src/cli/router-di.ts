/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { cli, Command, flag } from '@deepkit/app';
import { ApplicationServiceContainer } from '../application-service-container';

@cli.controller('debug:di', {
})
export class DebugDIController implements Command {
    constructor(
        protected serviceContainer: ApplicationServiceContainer,
    ) {
    }

    async execute(
        @flag.optional scope?: string,
    ): Promise<void> {
        const modules = [this.serviceContainer.appModule, ...this.serviceContainer.appModule.getImports()];

        let injectorContext = this.serviceContainer.getRootInjectorContext();

        if (scope) {
            console.log('For scope', scope);
            injectorContext = injectorContext.createChildScope(scope);
        }
        console.log('injectorContext.configuredProviderRegistry', injectorContext.configuredProviderRegistry!.calls);

        for (const module of modules) {
            console.log(`Module ${module.getName() || 'root'} DI retriever:`);
            const context = this.serviceContainer.getContextFor(module);
            console.log((injectorContext.getInjector(context.id) as any).retriever.toString());
        }
    }
}
