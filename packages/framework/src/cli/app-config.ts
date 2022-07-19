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
import { DebugController } from '../debug/debug.controller.js';
import { ConfigOption } from "@deepkit/framework-debug-api";
import { ReflectionClass } from "@deepkit/type";
import { createTable } from 'nice-table';
import { inspect } from 'util';

@cli.controller('app:config', {})
export class AppConfigController implements Command {
    constructor(
        protected debug: DebugController
    ) {
    }

    async execute(): Promise<void> {
        const configs = this.debug.configuration();
        console.log('Application config');
        this.logConfigTable(configs.appConfig);
        console.log('Modules config');
        this.logConfigTable(configs.modulesConfig);
    }

    private logConfigTable(config: ConfigOption[]) {
        console.log(
            createTable(config, ReflectionClass.from(ConfigOption).getPropertyNames() as (keyof ConfigOption)[], {
                horizontalAlignment: 'middle',
                verticalAlignment: 'middle',
                columnSizing: 'stretch',
                maxWidth: process.stdout.columns,
                fullWidth: true,
                throwIfTooSmall: false,
                indexColumn: false,
                stringify: (value) => inspect(value, { colors: true })
            })
        );
    }
}
