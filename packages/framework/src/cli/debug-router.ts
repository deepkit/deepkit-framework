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
import { HttpRouter } from '@deepkit/http';

/**
 * @description Prints debugging information about the router.
 */
@cli.controller('debug:router')
export class DebugRouterController implements Command {
    constructor(
        protected router: HttpRouter,
    ) {
    }

    async execute(): Promise<void> {
        this.router.resolve('GET', '/');
        console.log((this.router as any).fn.toString());
    }
}
