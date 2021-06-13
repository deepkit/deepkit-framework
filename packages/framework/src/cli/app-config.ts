/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { cli, Command } from '@deepkit/app';
import { DebugController } from '../debug/debug.controller';

@cli.controller('app:config', {})
export class AppConfigController implements Command {
    constructor(
        protected debug: DebugController
    ) {
    }

    async execute(): Promise<void> {
        const configs = this.debug.configuration();
        console.log('Application config');
        console.table(configs.appConfig);
        console.log('Modules config');
        console.table(configs.modulesConfig);
    }
}
