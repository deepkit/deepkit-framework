import { Injectable } from "injection-js";
import {ProcessLock} from "./process-locker";
import {Exchange} from "./exchange";

@Injectable()
export class GlobalLocker {
    constructor(protected exchange: Exchange) {
    }

    /**
     *
     * @param id
     * @param timeout optional defines when the times automatically unlocks.
     */
    public async acquireLock(id: string, timeout?: number): Promise<ProcessLock> {
        const lock = new ProcessLock(id);
        await lock.acquire(timeout);

        return lock;
    }

    public async tryLock(id: string, timeout?: number): Promise<ProcessLock | undefined> {
        const lock = new ProcessLock(id);

        if (await lock.tryLock(timeout)) {
            return lock;
        }

        return;
    }

    public async isLocked(id: string): Promise<boolean> {
        return false;
        // return !!LOCKS[id];
    }
}
