import { cast } from '@deepkit/type';
import { PoolConfig } from 'mariadb';

interface AdapterClientConfig {
    acquireTimeout?: number;
    connectionLimit?: number;
    idleTimeout?: number;
    initializationTimeout?: number;
    minDelayValidation?: number;
    minimumIdle?: number;
    resetAfterUse?: boolean;
    noControlAfterUse?: boolean;
    leakDetectionTimeout?: number;

    database?: string;
    connectAttributes?: any;
    charset?: string;
    collation?: string;
    user?: string;
    password?: string;

    host?: string;
    port?: number;
    socketPath?: string;
    connectTimeout?: number;
    socketTimeout?: number;
    debug?: boolean;
    debugCompress?: boolean;
    debugLen?: number;
    logParam?: boolean;
    trace?: boolean;
    multipleStatements?: boolean;
    ssl?: boolean;
    compress?: boolean;
    logPackets?: boolean;
    forceVersionCheck?: boolean;
    foundRows?: boolean;
    initSql?: string | string[];
    sessionVariables?: any;
    maxAllowedPacket?: number;
    keepAliveDelay?: number;
    rsaPublicKey?: string;
    cachingRsaPublicKey?: string;
    allowPublicKeyRetrieval?: boolean;
    insertIdAsNumber?: boolean;
    prepareCacheLength?: number;
    metaEnumerable?: boolean;
    metaAsArray?: boolean;
    rowsAsArray?: boolean;
}

export function parseConnectionString(url: string): PoolConfig {
    const parsed = new URL(url);

    const options: {[name: string]: any} = {};
    for (const [key, value] of parsed.searchParams.entries()) {
        options[key] = value;
    }

    return cast<AdapterClientConfig>({
        host: parsed.hostname,
        port: parsed.port,
        database: parsed.pathname.slice(1),
        user: parsed.username,
        password: parsed.password,
        ...options,
    });
}
