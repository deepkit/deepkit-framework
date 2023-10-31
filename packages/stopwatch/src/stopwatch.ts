/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { AnalyticData, encodeCompoundKey, FrameCategory, FrameData, FrameEnd, FrameStart, FrameType, TypeOfCategory } from './types.js';

export abstract class StopwatchStore {
    public frameQueue: (FrameStart | FrameEnd)[] = [];
    public dataQueue: FrameData[] = [];
    public analytics: AnalyticData[] = [];

    protected collectAnalyticsTimer?: any;
    protected runningFrames = 0;
    protected lastCollectAnalytics = 0;

    protected sync() {

    }

    async close() {

    }

    abstract run<T>(data: { [name: string]: any }, cb: () => Promise<T>): Promise<T>

    abstract getZone(): { [name: string]: any } | undefined;

    data(data: FrameData) {
        this.dataQueue.push(data);
        this.sync();
    }

    collectAnalytics() {
        if ('undefined' === typeof process) return;

        const now = Date.now();
        const cpu = process.cpuUsage();
        const memory = process.memoryUsage();
        this.analytics.push({
            timestamp: now,
            cpu: cpu.user + cpu.system,
            memory: memory.heapUsed,
            loopBlocked: this.lastCollectAnalytics ? now - this.lastCollectAnalytics : 0,
        });

        this.lastCollectAnalytics = now;
    }

    add(frame: FrameStart | FrameEnd): void {
        this.frameQueue.push(frame);

        if (frame.type === FrameType.start) {
            this.runningFrames++;
        } else {
            this.runningFrames--;
        }

        if (this.runningFrames === 0) {
            this.collectAnalytics();
            clearInterval(this.collectAnalyticsTimer);
            this.collectAnalyticsTimer = undefined;
        }

        if (this.runningFrames > 0 && !this.collectAnalyticsTimer) {
            this.collectAnalytics();
            this.collectAnalyticsTimer = setInterval(() => {
                this.collectAnalytics();
            }, 25);
        }
        this.sync();
    }
}

export class NoopStopwatchStore extends StopwatchStore {
    run<T>(data: { [name: string]: any }, cb: () => Promise<T>): Promise<T> {
        return cb();
    }

    getZone(): { [name: string]: any } | undefined {
        return undefined;
    }
}

export interface StopwatchFrameInterface<C extends FrameCategory> {
    data(data: TypeOfCategory<C>): void;

    end(): void;

    run<T>(cb: () => Promise<T> | T, data?: { [name: string]: any }): Promise<T>;
}

export class StopwatchFrame<C extends FrameCategory> implements StopwatchFrameInterface<C> {
    protected stopped = false;

    constructor(
        protected store: StopwatchStore,
        public context: number,
        public category: number,
        public cid: number,
    ) {
    }

    data(data: Partial<TypeOfCategory<C>>) {
        this.store.data({ cid: this.cid, category: this.category, data });
    }

    end() {
        if (this.stopped) return;

        this.stopped = true;
        this.store.add({ cid: this.cid, type: FrameType.end, timestamp: 0 });
    }

    run<T>(cb: () => Promise<T>, data: { [name: string]: any } = {}): Promise<T> {
        data.stopwatchContextId = this.context;
        return this.store.run(data, cb);
    }
}

export class NoopStopwatchFrame<C extends FrameCategory> implements StopwatchFrameInterface<C> {
    data(data: any) {
    }

    end() {
    }

    run<T>(cb: () => Promise<T>, data: { [p: string]: any } = {}): Promise<T> {
        return cb();
    }
}

let frameId = 0;
let contextId = 0;

export class Stopwatch {
    /**
     * It's active when there is a StopwatchStore attached.
     * Per default its inactive.
     */
    public active: boolean = false;

    constructor(
        protected store?: StopwatchStore,
    ) {
        this.active = this.store !== undefined;
    }

    enable() {
        this.active = true;
    }

    disable() {
        this.active = false;
    }

    /**
     * Please check Stopwatch.active before using this method.
     *
     * When a new context is created, it's important to use StopwatchFrame.run() so that all
     * sub frames are correctly assigned to the new context.
     */
    public start<C extends FrameCategory>(label: string, category: C = FrameCategory.none as C, newContext: boolean = false): StopwatchFrameInterface<C> {
        if (!this.active) return new NoopStopwatchFrame();
        if (!this.store) throw new Error('Stopwatch not active');

        let context: number = 0;
        const zone = this.store.getZone();

        if (newContext) {
            context = ++contextId;
        } else {
            if (!zone) return new NoopStopwatchFrame();
            context = zone.stopwatchContextId;
            // might be getting an empty object on some platforms, which we treat as no context (as we start new context only with stopwatchContextId)
            if (!context) return new NoopStopwatchFrame();
        }

        const id = ++frameId;
        const cid = encodeCompoundKey(id, 0);
        this.store.add({
            cid, type: FrameType.start, category,
            context: context, label, timestamp: 0,
        });

        return new StopwatchFrame(this.store, context, category, cid);
    }
}
