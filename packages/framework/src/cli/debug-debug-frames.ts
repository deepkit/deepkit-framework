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
import { join } from 'path';
import { readFileSync, unlinkSync } from 'fs';
import { decodeFrameData, decodeFrames } from '@deepkit/framework-debug-api';
import { FrameworkConfig } from '../module.config.js';
import { LoggerInterface } from '@deepkit/logger';

@cli.controller('debug:debug:frames', {})
export class DebugDebugFramesCommand implements Command {
    constructor(
        protected config: Pick<FrameworkConfig, 'varPath' | 'debugStorePath'>,
        protected logger: LoggerInterface,
    ) {
    }

    async execute(
        @flag reset: boolean = false,
    ): Promise<void> {
        const path = join(this.config.varPath, this.config.debugStorePath);
        if (reset) {
            unlinkSync(join(path, 'frames.bin'));
            unlinkSync(join(path, 'frames-data.bin'));
            this.logger.log('Files removed.');
            return;
        }

        console.log('frames', decodeFrames(readFileSync(join(path, 'frames.bin'))));
        console.log('data', decodeFrameData(readFileSync(join(path, 'frames-data.bin'))));
    }
}
