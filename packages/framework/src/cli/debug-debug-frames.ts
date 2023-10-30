/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { cli, Command, Flag } from '@deepkit/app';
import { FrameworkConfig } from '../module.config.js';
import { LoggerInterface } from '@deepkit/logger';
import { FrameCategory, Stopwatch, StopwatchStore } from '@deepkit/stopwatch';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { decodeFrames } from '@deepkit/framework-debug-api';
import { sleep } from '@deepkit/core';
import { FileStopwatchStore } from '../debug/stopwatch/store.js';

@cli.controller('debug:debug:frames', {})
export class DebugDebugFramesCommand implements Command {
    constructor(
        protected config: Pick<FrameworkConfig, 'varPath' | 'debugStorePath'>,
        protected logger: LoggerInterface,
        protected stopwatchStore: StopwatchStore,
        protected stopwatch: Stopwatch,
    ) {
    }

    async execute(
        reset: boolean & Flag = false,
    ): Promise<void> {
        if (reset) (this.stopwatchStore as FileStopwatchStore).removeAll();
        this.stopwatch.enable();
        console.log('start');

        const createScenario = async () => {
            const frame = this.stopwatch.start('Test', FrameCategory.http, true);

            await frame.run(async () => {
                for (let i = 0; i < 2; i++) {
                    const frame = this.stopwatch.start('Sub ' + i, FrameCategory.function);
                    if (i === 0) {
                        await sleep(0.1);
                    } else {
                        for (let i = 0; i < 2; i++) {
                            const frame = this.stopwatch.start('Sub sub ' + i, FrameCategory.function);
                            if (i === 0) {
                                await sleep(0.1);
                            } else {
                                for (let i = 0; i < 2; i++) {
                                    const frame = this.stopwatch.start('Sub sub sub ' + i, FrameCategory.function);
                                        await sleep(0.1);
                                    frame.end();
                                }
                            }

                            frame.end();
                        }
                    }
                    frame.end();
                }
            });

            frame.end();
        };

        const wait = createScenario();
        await sleep(0.05);
        await createScenario();
        await wait;

        console.log('end');
        //
        // console.log('bye');

        // await this.stopwatchStore.close();
        const path = join(this.config.varPath, this.config.debugStorePath);
        const framesPath = join(path, 'frames.bin');
        // // if (reset) {
        // //     unlinkSync(join(path, 'frames.bin'));
        // //     unlinkSync(join(path, 'frames-data.bin'));
        // //     this.logger.log('Files removed.');
        // //     return;
        // // }
        // //
        // // const frames: { [cid: number]: Frame } = {};
        if (existsSync(framesPath)) {
            decodeFrames(readFileSync(framesPath), (frame) => {
                console.log(frame);
                // if (frame.type === FrameType.start) {
                //     if (frame.category !== FrameCategory.http) return;
                //     frames[frame.cid] = new Frame(frame.cid, frame.timestamp, frame.context, frame.label, frame.category);
                // } else if (frame.type === FrameType.end) {
                //     const r = frames[frame.cid];
                //     if (!r) return;
                //     r.end = frame.timestamp;
                // }
            });
        }

        // for (const frame of Object.values(frames)) {
        //     if (frame.end) continue;
        //     console.log('Open frame', frame.label);
        // }

        // decodeFrameData(readFileSync(join(path, 'frames-data.bin')), (frame) => {
        //     const r = requests[frame.cid];
        //     if (!r) return;
        //     const data = deserializeFrameData(frame) as FrameCategoryData[FrameCategory.http];
        //     if (data.clientIp) r.clientIp = data.clientIp;
        //     if (data.method) r.method = data.method;
        //     if (data.url) r.url = data.url;
        //     if (data.responseStatus) r.statusCode = data.responseStatus;
        // });

    }
}
