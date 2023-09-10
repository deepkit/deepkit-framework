import { BehaviorSubject } from 'rxjs';
import { throttleTime } from '@deepkit/core';

export interface ProgressTrackerState {
    total: number;
    done: number;
    message: string;
    speed: number;
    stopped: boolean;
}

export class ProgressTrackerGroup {
    protected lastUpdate = Date.now();

    stopCallbacks: (() => void)[] = [];

    constructor(public state: ProgressTrackerState) {
    }

    changed() {
    }

    /**
     * Registers a callback that is called when the progress is stopped.
     */
    onStop(callback: () => void) {
        this.stopCallbacks.push(callback);
    }

    stop() {
        this.state.stopped = true;
        this.stopCallbacks.forEach(v => v());
        this.changed();
    }

    set total(total: number) {
        this.state.total = total;
        this.changed();
    }

    set message(message: string) {
        this.state.message = message;
        this.changed();
    }

    /**
     * Sets the number of items that are done.
     * This triggers a change event.
     */
    set done(done: number) {
        done = Math.min(done, this.state.total);
        //calculate speed
        const now = Date.now();
        const timeDiff = now - this.lastUpdate;
        this.lastUpdate = now;
        const diff = done - this.state.done;
        this.state.speed = diff / timeDiff * 1000;

        this.state.done = done;
        this.changed();
    }

    /**
     * Number between 0 and 1.
     */
    get progress(): number {
        return this.state.done / this.state.total;
    }

    /**
     * Number between 0 and 1.
     */
    set progress(progress: number) {
        this.done = Math.round(this.state.total * progress);
        this.changed();
    }

    /**
     * Total number of items to process.
     */
    get total(): number {
        return this.state.total;
    }

    /**
     * True if the progress is finished (done === total).
     * Same as progress === 1.
     */
    get finished() {
        return this.state.total === this.state.done;
    }

    /**
     * True if the progress is running (finished === false && stopped === false).
     */
    get running() {
        return !this.finished && !this.stopped;
    }

    /**
     * True if the progress is ended (finished === true || stopped === true).
     */
    get ended() {
        return !this.running;
    }

    /**
     * True if the progress is stopped (stopped === true), but might not be finished.
     */
    get stopped() {
        return this.state.stopped;
    }

    get message(): string {
        return this.state.message;
    }

    get done(): number {
        return this.state.done;
    }
}

/**
 * This class allows to track multiple progress states.
 *
 * Natively supported as return type in @deepkit/rpc methods.
 * The client can stop either a single progress state or all of them, to which the server
 * can react by stopping the current operation.
 *
 * @deepkit/desktop-ui has a component to display the progress.
 */
export class ProgressTracker extends BehaviorSubject<ProgressTrackerState[]> {
    groups: ProgressTrackerGroup[] = [];

    changed = throttleTime(() => {
        this.next(this.value);

        //check if all groups are done
        if (this.groups.every(v => v.done === v.total)) {
            this.complete();
        }
    }, 100);

    constructor(states: ProgressTrackerState[] = []) {
        super(states);
        this.groups = states.map(v => new ProgressTrackerGroup(v));
    }

    next(states: ProgressTrackerState[]) {
        //don't create new groups, but update existing ones, and remove old ones, and add new ones if needed
        for (let i = 0; i < states.length; i++) {
            if (i < this.groups.length) {
                const old = this.groups[i].state;
                const next = states[i];
                this.groups[i].state = next;
                if (old.stopped !== next.stopped) {
                    if (next.stopped) {
                        this.groups[i].stopCallbacks.forEach(v => v());
                    }
                }
            } else {
                this.groups.push(new ProgressTrackerGroup(states[i]));
            }
        }

        //remove old groups
        this.groups.splice(states.length, this.groups.length - states.length);

        super.next(states);
    }

    stop() {
        this.groups.forEach(v => v.stop());
        this.changed();
    }

    track(message: string = '', total: number, current: number = 0): ProgressTrackerGroup {
        const group = new ProgressTrackerGroup({ total, done: current, message, speed: 0, stopped: false });
        group.changed = () => {
            this.changed();
        };
        this.groups.push(group);
        this.value.push(group.state);
        this.changed();
        return group;
    }

    get progress(): number {
        if (this.groups.length === 0) return 0;
        return this.groups.reduce((v, group) => v + group.progress, 0) / this.groups.length;
    }

    /**
     * True if the progress is finished (done === total).
     * Same as progress === 1.
     */
    get finished(): boolean {
        return this.groups.every(v => v.finished);
    }

    /**
     * True if the progress is running (finished === false && stopped === false).
     */
    get running(): boolean {
        return this.groups.some(v => v.running);
    }

    /**
     * True if the progress is ended (finished === true || stopped === true).
     */
    get ended(): boolean {
        return !this.running;
    }

    /**
     * True if the progress is stopped (stopped === true), but might not be finished.
     */
    get stopped() {
        return this.groups.every(v => v.stopped);
    }

    get done(): number {
        return this.groups.reduce((v, group) => v + group.done, 0);
    }

    get total(): number {
        return this.groups.reduce((v, group) => v + group.total, 0);
    }

    get current(): ProgressTrackerGroup | undefined {
        return this.groups.find(v => v.running);
    }
}

export class ProgressTrackerWatcher<T extends ProgressTracker = ProgressTracker> extends BehaviorSubject<T> {
}

/**
 * Turns a ProgressTracker into a BehaviorSubject<ProgressTracker> aka ProgressTrackerWatcher.
 */
export function watchProgressTracker<T extends ProgressTracker>(tracker: T): ProgressTrackerWatcher<T> {
    const subject = new BehaviorSubject<T>(tracker);
    const sub = tracker.subscribe(() => {
        subject.next(tracker);
    }, (error) => subject.error(error), () => subject.complete());
    subject.subscribe().add(() => sub.unsubscribe());
    return subject;
}
