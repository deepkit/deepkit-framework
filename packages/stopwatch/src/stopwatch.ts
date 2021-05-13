/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { FrameCategory, FrameCategoryModel, FrameData, FrameEnd, FrameStart, FrameType } from './types';

export abstract class StopwatchStore {
    public frameQueue: (FrameStart | FrameEnd)[] = [];
    public dataQueue: FrameData[] = [];

    protected sync() {

    }

    abstract run<T>(data: { [name: string]: any }, cb: () => Promise<T>): Promise<T>

    abstract getZone(): { [name: string]: any } | undefined;

    data(data: FrameData) {
        this.dataQueue.push(data);
        this.sync();
    }

    add(frame: FrameStart | FrameEnd): number {
        this.frameQueue.push(frame);
        this.sync();
        return 0;
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
        this.store.add({ id: this.id, type: FrameType.end, worker: this.worker, timestamp: 0 });
    }

    run<T>(data: { [name: string]: any }, cb: () => Promise<T>): Promise<T> {
        data.stopwatchContextId = this.context;
        return this.store.run(data, cb);
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
        let context: number = 0;
        const zone = this.store.getZone();

        if (newContext || !zone) {
            context = ++contextId;
        } else {
            context = zone.stopwatchContextId;
            if (!context) throw new Error('No Stopwatch context given');
        }

        const worker = this.store.add({
            id, type: FrameType.start, worker: 0, category,
            context: context, label, timestamp: 0,
        });

        return new StopwatchFrame(this.store, context, category, id, worker);
    }
}
