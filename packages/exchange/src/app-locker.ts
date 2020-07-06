import {Injectable} from "injection-js";
import {Exchange, ExchangeLock} from "./exchange";

@Injectable()
export class AppLocker {
    constructor(protected exchange: Exchange) {
    }

    /**
     *
     * @param id
     * @param timeout optional defines when the times automatically unlocks.
     */
    public async acquireLock(id: string, timeout?: number): Promise<ExchangeLock> {
        return this.exchange.lock(id, timeout);
    }

    public async isLocked(id: string): Promise<boolean> {
        return this.exchange.isLocked(id);
    }
}
