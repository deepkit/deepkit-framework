import { arrayRemoveItem } from '@deepkit/core';
import { FrameCategory, FrameEnd, FrameStart, FrameType } from '@deepkit/stopwatch';

export const defaultColors = { border: 0x73ab77, bg: 0x497a4c };

export const frameColors: {
    [type in FrameCategory]?: { border: number; bg: number };
} = {
    [FrameCategory.database]: { border: 0x737dab, bg: 0x49497a },
    [FrameCategory.http]: { border: 0x7392ab, bg: 0x496c7a },
    [FrameCategory.template]: { border: 0xaf9c42, bg: 0x8d7522 },
    [FrameCategory.rpc]: { border: 0xab79dd, bg: 0x6706b2 },
    [FrameCategory.cli]: { border: 0x79d7dd, bg: 0x069eb2 },
};

export function formatTime(microseconds: number, fixed: number = 1): string {
    if (microseconds === 0) return '0';
    if (Math.abs(microseconds) < 1_000) return parseFloat(microseconds.toFixed(fixed)) + 'µs';
    if (Math.abs(microseconds) < 1_000_000) return parseFloat((microseconds / 1000).toFixed(fixed)) + 'ms';
    if (Math.abs(microseconds) < 2 * 60_000_000) return parseFloat((microseconds / 1000 / 1000).toFixed(fixed)) + 's';

    return parseFloat((microseconds / 1000 / 1000 / 60).toFixed(fixed)) + 'min';
}

export class ViewState {
    scrollX: number = 0;
    zoom: number = 500;
    width: number = 500;
    height: number = 100;
    scrollWidth: number = 1;
    windowPadding: number = 0;
}

export function getCrunchX(crunch: Crunch, viewState: ViewState): number {
    return crunch.x + ((crunch.context?.allCrunches || 0) - 1) * 80 * viewState.zoom;
}

export function getCrunchXCanvas(crunch: Crunch, viewState: ViewState): number {
    const x = (crunch.x - viewState.scrollX) / viewState.zoom;
    return ((crunch.context?.allCrunches || 0) - 1) * 80 + x;
}

export function getFrameX(frame: FrameItem, viewState: ViewState): number {
    return frame.x + (frame.context.allCrunches || 0) * 80 * viewState.zoom;
}

export function getFrameWidth(frame: FrameItem, viewState: ViewState): number {
    const width = frame.took / viewState.zoom;
    // const width = (frame.took - frame.crunch) / viewState.zoom;
    // if (frame.root) return width + ((frame.context?.allCrunches || 0) * 80);
    return width;
}

export function getFrameXCanvas(frame: FrameItem, viewState: ViewState): number {
    const x = (frame.x - viewState.scrollX) / viewState.zoom;
    return x + (frame.context.allCrunches || 0) * 80;
}

export interface Crunch {
    x: number;
    y: number;
    context: FrameContext;
    crunch: number;
    issued: boolean;
    container?: any;
}

function getWindow(viewState: ViewState) {
    const start = viewState.scrollX - viewState.windowPadding;
    const end = start + viewState.width * viewState.zoom + viewState.windowPadding;
    return { start, end };
}

export interface FrameItem {
    frame: FrameStart;
    took: number;
    x: number;
    y: number;
    data?: { [name: string]: any };
    crunch: number;
    context: FrameContext;
    issued: boolean;
    root: boolean;
    frames: number;
    container?: any;
}

export interface FrameContext {
    id: number;
    // all other contexts that depend on this one
    // necessary since we need to update our dependents once y is increased.
    children: FrameContext[];
    lastFrame?: FrameItem;
    parentContext?: FrameContext;
    crunches: Crunch[];
    allCrunches: number; //how many crunches there are before it, including it
    y: number;
    maxY: number;
    items: FrameItem[];
    root: FrameItem;
}

export interface ChangeFeed<T> {
    create?: T[];
    update?: T[];
    remove?: T[];
}

type FrameCallback = (frames: ChangeFeed<FrameItem>, crunches: ChangeFeed<Crunch>) => void;

interface FrameWindow {
    start: number;
    end: number;
}

/**
 * The size the crunch element in the render has.
 */
export const crunchSize: number = 35_000;

class FrameSubscription {
    protected framesChanged: ChangeFeed<FrameItem> = {};
    protected crunchesChanged: ChangeFeed<Crunch> = {};

    constructor(
        public callback: FrameCallback,
        public viewState: ViewState,
    ) {}

    addCrunch(crunch: Crunch) {
        if (!this.crunchesChanged.create) this.crunchesChanged.create = [];
        this.crunchesChanged.create.push(crunch);
    }

    addFrame(frame: FrameItem) {
        if (!this.framesChanged.create) this.framesChanged.create = [];
        this.framesChanged.create.push(frame);
    }

    removeFrame(frame: FrameItem) {
        if (!this.framesChanged.remove) this.framesChanged.remove = [];
        this.framesChanged.remove.push(frame);
    }

    updateFrame(frame: FrameItem) {
        if (!this.framesChanged.update) this.framesChanged.update = [];
        this.framesChanged.update.push(frame);
    }

    flush() {
        this.callback(this.framesChanged, this.crunchesChanged);
        this.framesChanged = {};
        this.crunchesChanged = {};
    }
}

function assignLastFrame(container: { lastFrame?: FrameItem }, f: FrameItem) {
    if (!container.lastFrame) container.lastFrame = f;
    if (container.lastFrame.took) {
        if (container.lastFrame.x + container.lastFrame.took < f.x + f.took) container.lastFrame = f;
    } else if (container.lastFrame.frame.timestamp < f.frame.timestamp + f.took) {
        container.lastFrame = f;
    }
}

/**
 * This class is responsible for maintaining a window of frames that should be displayed.
 * All frameStart/frameEnd are feed to this class, and it maintains the frames positions for the canvas.
 */
export class FrameParser {
    public items: FrameItem[] = [];
    public crunches: Crunch[] = [];
    public frames: number = 0;

    public rootItems: FrameItem[] = [];

    public lastFrame?: FrameItem;

    protected openContexts: FrameContext[] = [];
    protected lastOpenContext?: FrameContext;

    protected subscriptions: FrameSubscription[] = [];
    protected rootCallbacks: ((items: FrameItem[]) => void)[] = [];

    reset() {
        const remove: FrameItem[] = [];
        //check which to delete
        for (const item of this.items) {
            if (!item) continue;
            if (!item.issued) continue;
            remove.push(item);
        }

        this.frames = 0;
        this.items = [];
        this.rootItems = [];
        this.openContexts = [];

        for (const sub of this.subscriptions) {
            sub.callback({ remove }, { remove: this.crunches });
        }

        for (const cb of this.rootCallbacks) {
            cb(this.rootItems);
        }
    }

    subscribeRoot(callback: (items: FrameItem[]) => void) {
        this.rootCallbacks.push(callback);
        if (this.rootItems.length) callback(this.rootItems);

        return {
            unregister: () => {
                const index = this.rootCallbacks.findIndex(v => v === callback);
                this.rootCallbacks.splice(index, 1);
            },
        };
    }

    subscribe(callback: FrameCallback, viewState: ViewState) {
        this.subscriptions.push(new FrameSubscription(callback, viewState));

        return {
            checkWindow: () => this.checkWindow(callback, viewState),
            unregister: () => {
                const index = this.subscriptions.findIndex(v => v.callback === callback);
                this.subscriptions.splice(index, 1);
            },
        };
    }

    inWindow(item: FrameItem, viewState: ViewState, window: { start: number; end: number }): boolean {
        const start = getFrameX(item, viewState);
        const end = start + item.took;
        return (
            (item.took === 0 && start <= window.end) || (item.took > 0 && end >= window.start && start <= window.end)
        );
    }

    /**
     * Window changed, so check which frames to add or remove.
     */
    checkWindow(callback: FrameCallback, viewState: ViewState) {
        const buildChange = <T extends { issued: boolean }>(
            items: T[],
            inWindow: (item: T) => boolean,
        ): ChangeFeed<T> => {
            const change: ChangeFeed<T> = {};

            for (const item of items) {
                if (!item) continue; //array might have holes
                if (item.issued) {
                    if (!inWindow(item)) {
                        item.issued = false;
                        if (!change.remove) change.remove = [];
                        change.remove.push(item);
                    }
                } else {
                    if (inWindow(item)) {
                        item.issued = true;
                        if (!change.create) change.create = [];
                        change.create.push(item);
                    }
                }
            }
            return change;
        };
        const window = getWindow(viewState);
        const framesChanged = buildChange(this.items, item => this.inWindow(item, viewState, window));

        const chrunchesChanged = buildChange(this.crunches, item => {
            const start = getCrunchX(item, viewState);
            const end = start + crunchSize;
            return end >= window.start && start <= window.end;
        });

        callback(framesChanged, chrunchesChanged);
    }

    getContext(contextId: number): FrameContext | undefined {
        if (this.lastOpenContext && this.lastOpenContext.id === contextId) return this.lastOpenContext;

        for (const context of this.openContexts) {
            if (context.id === contextId) return context;
        }
        return;
    }

    addFrame(item: FrameItem) {
        for (const sub of this.subscriptions) {
            const window = getWindow(sub.viewState);
            if (this.inWindow(item, sub.viewState, window)) {
                item.issued = true;
                sub.addFrame(item);
            }
        }
    }

    addCrunch(x: number, y: number, size: number, context: FrameContext) {
        const crunch: Crunch = { x, y, crunch: size, issued: false, context };
        this.crunches.push(crunch);
        for (const sub of this.subscriptions) {
            // if (crunch.x - crunch.crunch > sub.window.start && crunch.x + crunchSize < sub.window.end) {
            crunch.issued = true;
            sub.addCrunch(crunch);
            // }
        }
        return crunch;
    }

    feed(frames: (FrameStart | FrameEnd)[]) {
        //todo check updated
        //todo removed: when took is set and its out of window
        let newRoots = false;

        for (const frame of frames) {
            // console.log('feed', frame);
            if (frame.type === FrameType.start) {
                let context = this.getContext(frame.context);
                const root = !context;

                const item: FrameItem = {
                    frame,
                    took: 0,
                    y: 0,
                    x: 0,
                    crunch: 0,
                    root,
                    issued: false,
                    frames: 0,
                    context: {} as any,
                };

                if (context) {
                    item.context = context;
                    context.y++;
                }

                if (!context) {
                    const parentContext = this.openContexts[this.openContexts.length - 1];

                    context = {
                        id: frame.context,
                        y: 0,
                        maxY: 0,
                        children: [],
                        crunches: [],
                        lastFrame: undefined,
                        allCrunches: parentContext ? parentContext.allCrunches : 0,
                        parentContext,
                        // y: this.openContexts.length ? this.openContexts[this.openContexts.length - 1].y : 0,
                        // dependsOn: this.openContexts.length ? this.openContexts.slice(0) : [],
                        root: item,
                        items: [],
                    };
                    item.context = context;

                    if (parentContext) {
                        context.maxY = context.y = parentContext.y + 2;

                        item.x = parentContext.root.x + (frame.timestamp - parentContext.root.frame.timestamp);

                        if (parentContext.lastFrame) {
                            // const crunch = parentContext.lastFrame.x + parentContext.lastFrame.took - item.x;
                            // if (crunch > 1000) {
                            //     context.crunches.push(this.addCrunch(parentContext.lastFrame.x + parentContext.lastFrame.took, context.y, crunch));
                            //     item.x = parentContext.lastFrame.x + parentContext.lastFrame.took + crunchSize;
                            // } else {
                            //     item.x = parentContext.lastFrame.x + parentContext.lastFrame.took;
                            // }
                            const lastFrame = parentContext.lastFrame;
                            context.allCrunches = lastFrame.context.allCrunches;
                            const diff = frame.timestamp - (lastFrame.frame.timestamp + lastFrame.took);
                            item.x = lastFrame.x + lastFrame.took + diff;
                            const crunch = item.x - (lastFrame.x + lastFrame.took);
                            if (crunch > 1000) {
                                context.crunches.push(
                                    this.addCrunch(lastFrame.x + lastFrame.took, context.y, crunch, context),
                                );
                                context.allCrunches++;
                                item.x = lastFrame.x + lastFrame.took;
                            }
                        } else {
                            const crunch = item.x - parentContext.root.x;
                            if (crunch > 1000) {
                                context.crunches.push(this.addCrunch(parentContext.root.x, context.y, crunch, context));
                                // parentContext.root.crunch += crunch;
                                context.allCrunches++;
                                item.x = parentContext.root.x;
                            } else {
                                item.x = parentContext.root.x;
                            }
                        }
                        assignLastFrame(parentContext, item);
                    } else if (this.lastFrame) {
                        const lastFrame = this.lastFrame;
                        context.allCrunches = lastFrame.context.allCrunches;
                        const diff = frame.timestamp - (lastFrame.frame.timestamp + lastFrame.took);
                        item.x = lastFrame.x + lastFrame.took + diff;
                        const crunch = item.x - (lastFrame.x + lastFrame.took);
                        if (crunch > 1000) {
                            context.crunches.push(
                                this.addCrunch(lastFrame.x + lastFrame.took, context.y, crunch, context),
                            );
                            context.allCrunches++;
                            item.x = lastFrame.x + lastFrame.took;
                        }
                    }

                    if (!this.lastFrame || this.lastFrame.frame.timestamp < frame.timestamp) this.lastFrame = item;

                    this.lastOpenContext = context;
                    for (const dependOn of this.openContexts) dependOn.children.push(context);
                    this.openContexts.push(context);
                } else {
                    item.x = context.root.x + (frame.timestamp - context.root.frame.timestamp);
                }

                item.context = context;

                item.y = context.y;
                if (context.y > context.maxY) {
                    const diff = context.y - context.maxY;
                    context.maxY = item.y;
                    for (const dependent of context.children) {
                        dependent.y += diff;
                        dependent.maxY = dependent.y;
                        for (const frame of dependent.items) {
                            frame.y += diff;
                        }
                        for (const c of dependent.crunches) {
                            c.y += diff;
                        }
                    }
                }
                this.items[frame.cid] = item;
                this.frames++;
                context.items.push(item);

                if (!root) {
                    context.root.frames++;
                }

                if (item.root) {
                    this.rootItems.push(item);
                    newRoots = true;
                }

                this.addFrame(item);
            } else if (frame.type === FrameType.end) {
                const f = this.items[frame.cid];
                if (!f) continue;
                f.took = frame.timestamp - f.frame.timestamp;

                assignLastFrame(this, f);

                const context = this.getContext(f.frame.context);
                if (context) {
                    if (context.parentContext) {
                        assignLastFrame(context.parentContext, f);
                    }
                    context.y--;
                    if (f.root) {
                        if (context.lastFrame) {
                            const restCrunch =
                                f.x + f.took - context.lastFrame.x - context.lastFrame.took - context.root.crunch;
                            // f.crunch += restCrunch;
                        }
                        //close context
                        if (this.lastOpenContext && this.lastOpenContext.id === context.id) {
                            this.lastOpenContext = undefined;
                        }
                        arrayRemoveItem(this.openContexts, context);
                    }
                }
            }
        }

        if (newRoots) {
            for (const cb of this.rootCallbacks) {
                cb(this.rootItems);
            }
        }

        for (const sub of this.subscriptions) {
            sub.flush();
        }
    }
}
