/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { performance } from 'perf_hooks';
import cluster from 'cluster';
import { SimpleStore, Zone } from './zone';
import { FrameCategory, FrameCategoryModel, FrameData, FrameEnd, FrameStart, FrameType } from './types';

export class StopwatchStore {
    public frameQueue: (FrameStart | FrameEnd)[] = [];
    public dataQueue: FrameData[] = [];

    protected sync() {

    }

    data(data: FrameData) {
        this.dataQueue.push(data);
        this.sync();
    }

    add(frame: FrameStart | FrameEnd) {
        this.frameQueue.push(frame);
        this.sync();
    }
}

export class StopwatchFrame<C extends FrameCategory & keyof FrameCategoryModel> {
    constructor(
        protected store: StopwatchStore,
        public context: number,
        public category: number,
        public id: number,
        public worker: number,
    ) {
    }

    data(data: Partial<FrameCategoryModel[C]>) {
        this.store.data({ id: this.id, category: this.category, worker: this.worker, data });
    }

    end() {
        this.store.add({ id: this.id, type: FrameType.end, worker: this.worker, timestamp: Math.floor(performance.timeOrigin * 1_000 + performance.now() * 1_000) });
    }

    run<T>(data: SimpleStore, cb: () => Promise<T>): Promise<T> {
        data.stopwatchContextId = this.context;
        return Zone.run(data, cb);
    }
}

let frameId = 0;
let contextId = 0;

export class Stopwatch {
    public times: { [name: string]: { stack: number[], time: number } } = {};

    /**
     * It's active when there is a StopwatchStore attached.
     * Per default its inactive.
     */
    public active = false;

    constructor(
        protected store?: StopwatchStore,
    ) {
        this.active = this.store !== undefined;
    }

    /**
     * Please check Stopwatch.active before using this method.
     *
     * When a new context is created, it's important to use StopwatchFrame.run() so that all
     * sub frames are correctly assigned to the new context.
     */
    public start<C extends FrameCategory & keyof FrameCategoryModel>(label: string, category: C = FrameCategory.none as C, newContext: boolean = false): StopwatchFrame<C> {
        if (!this.active || !this.store) throw new Error('Stopwatch not active');

        const id = ++frameId;
        const worker = cluster.isWorker ? cluster.worker.id : 0;
        let context: number = 0;
        const zone = Zone.current();

        if (newContext || !zone) {
            context = ++contextId;
        } else {
            context = zone.stopwatchContextId;
            if (!context) throw new Error('No Stopwatch context given');
        }

        this.store.add({ id, type: FrameType.start, worker, category, context: context, label, timestamp: Math.floor(performance.timeOrigin * 1_000 + performance.now() * 1_000) });

        return new StopwatchFrame(this.store, context, category, id, worker);
    }
}
