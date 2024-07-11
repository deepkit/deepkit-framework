import { parseTime } from './utils.js';
import { ReceiveType, resolveReceiveType, Type } from '@deepkit/type';
import { BrokerAdapterBase } from './broker.js';
import { ConsoleLogger, LoggerInterface } from '@deepkit/logger';

export interface BrokerKeyValueOptions {
    /**
     * Relative time to live in milliseconds. 0 means no ttl.
     *
     * Value is either milliseconds or a string like '2 minutes', '8s', '24hours'.
     */
    ttl: number | string;
}

export interface BrokerKeyValueOptionsResolved extends BrokerKeyValueOptions {
    ttl: number;
}

export function parseBrokerKeyValueOptions(options: Partial<BrokerKeyValueOptions>): BrokerKeyValueOptionsResolved {
    return {
        ttl: parseTime(options.ttl) ?? 0,
    };
}

export interface BrokerAdapterKeyValue extends BrokerAdapterBase {
    get(key: string, type: Type): Promise<any>;

    set(key: string, value: any, options: BrokerKeyValueOptionsResolved, type: Type): Promise<any>;

    remove(key: string): Promise<any>;

    increment(key: string, value: any): Promise<number>;
}

export class BrokerKeyValueItem<T> {
    constructor(
        private key: string,
        private type: Type,
        private adapter: BrokerAdapterKeyValue,
        private options: BrokerKeyValueOptionsResolved,
    ) {

    }

    /**
     * @see BrokerKeyValue.get
     */
    async get(): Promise<T> {
        return this.adapter.get(this.key, this.type);
    }

    /**
     * @see BrokerKeyValue.set
     */
    async set(value: T): Promise<void> {
        await this.adapter.set(this.key, value, this.options, this.type);
    }

    /**
     * @see BrokerKeyValue.increment
     */
    async increment(value: number): Promise<number> {
        return this.adapter.increment(this.key, value);
    }

    async remove(): Promise<void> {
        return this.adapter.remove(this.key);
    }
}

export class BrokerKeyValue {
    private config: BrokerKeyValueOptionsResolved;

    constructor(
        private adapter: BrokerAdapterKeyValue,
        config: Partial<BrokerKeyValueOptions> = {},
        private logger: LoggerInterface = new ConsoleLogger(),
    ) {
        this.config = parseBrokerKeyValueOptions(config);
    }

    /**
     * Returns a new BrokerKeyValueItem for the given key.
     */
    item<T>(key: string, options?: Partial<BrokerKeyValueOptions>, type?: ReceiveType<T>): BrokerKeyValueItem<T> {
        return new BrokerKeyValueItem(
            key, resolveReceiveType(type), this.adapter,
            parseBrokerKeyValueOptions(Object.assign({}, this.config, options)),
        );
    }

    /**
     * Returns the value for the given key.
     */
    async get<T>(key: string, type?: ReceiveType<T>): Promise<T> {
        return this.adapter.get(key, resolveReceiveType(type));
    }

    /**
     * Sets the value for the given key.
     */
    async set<T>(key: string, value: T, options?: Partial<BrokerKeyValueOptions>, type?: ReceiveType<T>): Promise<void> {
        return this.adapter.set(key, value,
            options ? parseBrokerKeyValueOptions(Object.assign({}, this.config, options)) : this.config,
            resolveReceiveType(type),
        );
    }

    async remove(key: string): Promise<void> {
        return this.adapter.remove(key);
    }

    /**
     * Increments the value for the given key by the given value.
     * Note that this is not compatible to get/set, as it only works with numbers.
     * Since this an atomic increment, there is no way to get the current value via `get` and then increment it,
     * but you have to use `increment(0)` to get the current value.
     */
    async increment(key: string, value: number): Promise<number> {
        return this.adapter.increment(key, value);
    }
}
