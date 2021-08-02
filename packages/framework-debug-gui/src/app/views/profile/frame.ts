import { FrameCategory, FrameEnd, FrameStart, FrameType } from '@deepkit/stopwatch';
import { arrayRemoveItem } from '@deepkit/core';

export const defaultColors = { border: 0x73AB77, bg: 0x497A4C };

export const frameColors: { [type in FrameCategory]?: { border: number, bg: number } } = {
    [FrameCategory.database]: { border: 0x737DAB, bg: 0x49497A },
    [FrameCategory.http]: { border: 0x7392AB, bg: 0x496C7A },
    [FrameCategory.template]: { border: 0xAF9C42, bg: 0x8D7522 },
    [FrameCategory.rpc]: { border: 0xAB79DD, bg: 0x6706B2 },
    [FrameCategory.cli]: { border: 0x79D7DD, bg: 0x069EB2 },
};

export function formatTime(microseconds: number, fixed: number = 1): string {
    if (microseconds === 0) return '0';
    if (Math.abs(microseconds) < 1_000) return parseFloat(microseconds.toFixed(fixed)) + 'µs';
    if (Math.abs(microseconds) < 1_000_000) return parseFloat((microseconds / 1000).toFixed(fixed)) + 'ms';
    return parseFloat((microseconds / 1000 / 1000).toFixed(fixed)) + 's';
}

export interface FrameItem {
    frame: FrameStart;
    took: number;
    x: number;
    y: number;
    data?: { [name: string]: any };
    issued: boolean;
    root: boolean;
    frames: number;
    container?: any;
}

export interface FrameContext {
    id: number;
    dependsOn: FrameContext[];
    y: number;
    items: FrameItem[];
    root: FrameItem;
}

type FrameCallback = (create: FrameItem[], update: FrameItem[], remove: FrameItem[]) => void;

interface FrameWindow {
    start: number;
    end: number;
}

class FrameSubscription {
    protected create: FrameItem[] = [];
    protected remove: FrameItem[] = [];
    protected update: FrameItem[] = [];

    constructor(
        public callback: FrameCallback,
        public window: FrameWindow,
    ) {
    }

    addCreate(frame: FrameItem) {
        this.create.push(frame);
    }

    addRemove(frame: FrameItem) {
        this.remove.push(frame);
    }

    addUpdate(frame: FrameItem) {
        this.update.push(frame);
    }

    flush() {
        if (this.create.length || this.remove.length || this.update.length) {
            this.callback(this.create, this.update, this.remove);
            this.create.length = 0;
            this.update.length = 0;
            this.remove.length = 0;
        }
    }
}

/**
 * This class is responsible for maintaining a window of frames that should be displayed.
 * All frameStart/frameEnd are feed to this class and it maintains the frames positions for the canvas.
 */
export class FrameParser {
    public items: FrameItem[] = [];

    public rootItems: FrameItem[] = [];

    protected openContexts: FrameContext[] = [];
    protected lastOpenContext?: FrameContext;

    public offsetX: number = 0; //where the first frame starts. We place all boxes accordingly, so `0` starts here.

    protected subscriptions: FrameSubscription[] = [];
    protected rootCallbacks: ((items: FrameItem[]) => void)[] = [];

    subscribeRoot(callback: (items: FrameItem[]) => void) {
        this.rootCallbacks.push(callback);
        if (this.rootItems.length) callback(this.rootItems);

        return {
            unregister: () => {
                const index = this.rootCallbacks.findIndex(v => v === callback);
                this.rootCallbacks.splice(index, 1);
            }
        };
    }

    subscribe(callback: FrameCallback, window: FrameWindow = { start: 0, end: 0 }) {
        this.subscriptions.push(new FrameSubscription(callback, window));

        const checkWindow = () => {
            this.checkWindow(callback, window);
        };
        return {
            setWindow(w: FrameWindow) {
                Object.assign(window, w);
                checkWindow();
            },
            checkWindow,
            unregister: () => {
                const index = this.subscriptions.findIndex(v => v.callback === callback);
                this.subscriptions.splice(index, 1);
            }
        };
    }

    inWindow(item: FrameItem, window: { start: number, end: number }): boolean {
        const start = item.x - this.offsetX;
        const end = start + item.took;
        return (start > window.start && start < window.end)
            || (item.took >= 0 && end > window.start && end < window.end)
            || (item.took >= 0 && start < window.start && end > window.end)
            // || (item.took === -1 && start < window.end) //todo: current time is important
            ;
    }

    /**
     * Window changed, so check which frames to add or remove.
     */
    checkWindow(callback: FrameCallback, window: FrameWindow) {
        const create: FrameItem[] = [];
        const remove: FrameItem[] = [];

        //check which to delete
        for (const item of this.items) {
            if (!item) continue;
            if (!item.issued) continue;

            if (!this.inWindow(item, window)) {
                item.issued = false;
                remove.push(item);
            }
        }

        //check which to create
        for (const item of this.items) {
            if (!item) continue;
            if (item.issued) continue;

            if (this.inWindow(item, window)) {
                item.issued = true;
                create.push(item);
            }
        }

        if (create.length || remove.length) {
            callback(create, [], remove);
        }
    }

    getContext(contextId: number): FrameContext | undefined {
        if (this.lastOpenContext && this.lastOpenContext.id === contextId) return this.lastOpenContext;

        for (const context of this.openContexts) {
            if (context.id === contextId) return context;
        }
        return;
    }

    feed(frames: (FrameStart | FrameEnd)[]) {
        //todo check updated
        //todo removed: when took is set and its out of window
        const newRoots: FrameItem[] = [];

        for (const frame of frames) {
            if (frame.type === FrameType.start) {
                if (!this.offsetX) this.offsetX = frame.timestamp;

                let context = this.getContext(frame.context);
                const root = !context;

                const item: FrameItem = { frame, took: -1, y: 0, x: frame.timestamp, root, issued: false, frames: 0 };

                if (!context) {
                    context = {
                        id: frame.context,
                        y: this.openContexts.length ? this.openContexts[this.openContexts.length - 1].y : 0,
                        dependsOn: this.openContexts.length ? this.openContexts.slice(0) : [],
                        root: item,
                        items: []
                    };
                    this.lastOpenContext = context;
                    this.openContexts.push(context);
                }

                item.y = ++context.y;
                this.items[frame.id] = item;
                context.items.push(item);

                if (!root) {
                    context.root.frames++;
                }

                if (item.root) {
                    this.rootItems.push(item);
                    newRoots.push(item);
                }

                for (const sub of this.subscriptions) {
                    if (this.inWindow(item, sub.window)) {
                        item.issued = true;
                        sub.addCreate(item);
                    }
                }
            } else if (frame.type === FrameType.end) {
                const f = this.items[frame.id];
                if (!f) continue;
                f.took = frame.timestamp - f.frame.timestamp;
                const context = this.getContext(f.frame.context);
                if (context) {
                    context.y--;
                    if (f.root) {
                        //close context
                        if (this.lastOpenContext && this.lastOpenContext.id === context.id) {
                            this.lastOpenContext = undefined;
                        }
                        arrayRemoveItem(this.openContexts, context);
                    }
                }
            }
        }

        if (newRoots.length) {
            for (const cb of this.rootCallbacks) {
                cb(newRoots);
            }
        }

        for (const sub of this.subscriptions) {
            sub.flush();
        }
    }
}
