/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {cli, Command, flag} from '../command';
import {Router} from '../router';
import {ServiceContainer} from '../service-container';

@cli.controller('debug:di', {
})
export class DebugDIController implements Command {
    constructor(
        protected serviceContainer: ServiceContainer,
    ) {
    }

    async execute(
        @flag.optional scope?: string,
    ): Promise<void> {
        const modules = [this.serviceContainer.appModule, ...this.serviceContainer.appModule.getImports()];

        let injectorContext = this.serviceContainer.rootInjectorContext;

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
