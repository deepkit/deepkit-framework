export class Timer {
    protected timeoutTimers: any[] = []; //any necessary to be compatible with NodeJS/Browser env

    public setTimeout(cb: () => void, timeout: number): any {
        const timer = setTimeout(cb, timeout);
        this.timeoutTimers.push(timer);
        return timer;
    }

    /**
     * Clears all timers at once.
     */
    public clear() {
        for (const timeout of this.timeoutTimers) {
            clearTimeout(timeout);
        }
    }
}
