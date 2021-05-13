import { FrameEnd, FrameStart, FrameType, StopwatchStore } from '@deepkit/stopwatch';
import { openSync, readFileSync, write } from 'fs';
import { join } from 'path';
import { decodeFrames, encodeFrameData, encodeFrames } from '@deepkit/framework-debug-api';
import { asyncOperation, Mutex } from '@deepkit/core';
import { Broker } from '../../broker/broker';
import { kernelConfig } from '../../kernel.config';
import { injectable } from '@deepkit/injector';
import { t } from '@deepkit/type';
import { Zone } from '../../zone';
import cluster from 'cluster';
import { performance } from 'perf_hooks';

class Config extends kernelConfig.slice(['varPath', 'debugStorePath']) {
}

@injectable()
export class FileStopwatchStore extends StopwatchStore {
    protected lastSync?: any;
    protected frameFileHandle?: number;
    protected frameDataFileHandle?: number;
    protected syncMutex = new Mutex;

    protected lastId: number = -1;
    protected lastContext: number = -1;

    protected frameChannel = this.broker.channel('_debug/frames', t.type(Uint8Array));

    constructor(
        protected config: Config,
        protected broker: Broker,
    ) {
        super();
    }

    run<T>(data: { [name: string]: any }, cb: () => Promise<T>): Promise<T> {
        return Zone.run(data, cb);
    }

    getZone(): { [name: string]: any } | undefined {
        return Zone.current();
    }

    add(frame: FrameStart | FrameEnd): number {
        frame.worker = cluster.isWorker ? cluster.worker.id : 0;
        frame.timestamp = Math.floor(performance.timeOrigin * 1_000 + performance.now() * 1_000);
        super.add(frame);
        return frame.worker;
    }

    protected async loadLastNumberRange() {
        if (this.lastId >= 0) return;

        if (!this.frameFileHandle) this.frameFileHandle = openSync(join(this.config.varPath, this.config.debugStorePath, 'frames.bin'), 'a+');
        if (!this.frameDataFileHandle) this.frameDataFileHandle = openSync(join(this.config.varPath, this.config.debugStorePath, 'frames-data.bin'), 'a');

        const data = readFileSync(this.frameFileHandle);
        if (data.byteLength === 0) {
            this.lastId = 0;
            this.lastContext = 0;
            return;
        }

        const frames = decodeFrames(data);
        for (let i = frames.length - 1; i >= 0; i--) {
            const frame = frames[i];
            if (frame.type === FrameType.start) {
                this.lastId = frame.id;
                this.lastContext = frame.context;
                return;
            }
        }
    }

    protected sync() {
        if (this.lastSync) return;

        this.lastSync = setTimeout(() => this.syncNow(), 250);
    }

    protected async syncNow() {
        await this.syncMutex.lock();
        try {
            this.lastSync = undefined;

            await this.loadLastNumberRange();
            if (!this.frameFileHandle) throw new Error('No frame file handle');
            if (!this.frameDataFileHandle) throw new Error('No frame data file handle');

            const frames = this.frameQueue.slice();
            const frameData = this.dataQueue.slice();
            this.frameQueue = [];
            this.dataQueue = [];

            for (const frame of frames) {
                frame.id += this.lastId;
                if (frame.type === FrameType.start) frame.context += this.lastContext;
            }

            for (const frame of frameData) {
                frame.id += this.lastId;
            }

            await asyncOperation((resolve, reject) => {
                const frameBytes = encodeFrames(frames);
                write(this.frameFileHandle!, frameBytes, (error) => {
                    this.frameChannel.publish(frameBytes);
                    if (error) reject(error); else resolve(undefined);
                });
            });

            await asyncOperation((resolve, reject) => {
                write(this.frameDataFileHandle!, encodeFrameData(frameData), (error) => {
                    if (error) reject(error); else resolve(undefined);
                });
            });
        } finally {
            this.syncMutex.unlock();
        }
    }

}
