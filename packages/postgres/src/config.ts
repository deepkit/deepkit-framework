import { ConnectionOptions } from 'tls';
import { PoolConfig } from 'pg';
import { cast } from '@deepkit/type';

interface AdapterClientConfig {
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    host?: string;
    connectionString?: string;
    keepAlive?: boolean;
    statement_timeout?: false | number;
    parseInputDatesAsUTC?: boolean;
    ssl?: boolean | ConnectionOptions;
    query_timeout?: number;
    keepAliveInitialDelayMillis?: number;
    idle_in_transaction_session_timeout?: number;
    application_name?: string;
    connectionTimeoutMillis?: number;

    max?: number;
    min?: number;
    idleTimeoutMillis?: number;
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
