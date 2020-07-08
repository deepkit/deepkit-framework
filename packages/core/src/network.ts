export class ParsedHost {
    public host: string = '127.0.0.1';
    public port: number = 0;
    public unixSocket: string = '';

    get isUnixSocket(): boolean {
        return this.unixSocket !== '';
    }

    get isHostname(): boolean {
        return this.unixSocket === '';
    }

    get hostWithIp(): string {
        return this.host + (this.port ? (this.host && ':') + this.port : '');
    }

    toString(): string {
        return this.isUnixSocket ? this.unixSocket : this.hostWithIp;
    }

    getWebSocketUrl(secure: boolean = false) {
        const protocol = secure ? 'wss' : 'ws';

        if (this.isUnixSocket) {
            return `${protocol}+unix://${this.unixSocket}`;
        }

        return `${protocol}://${this.hostWithIp}`;
    }

    getHttpUrl(secure: boolean = false) {
        if (this.isUnixSocket) {
            return `file://${this.unixSocket}`;
        }

        const protocol = secure ? 'https' : 'http';
        return `${protocol}://${this.hostWithIp}`;
    }
}

export function parseHost(hostWithIpOrUnixPath: string): ParsedHost {
    const parsedHost = new ParsedHost();

    if (hostWithIpOrUnixPath.includes('/') || hostWithIpOrUnixPath.includes('\\') || hostWithIpOrUnixPath.endsWith('.sock')) {
        parsedHost.unixSocket = hostWithIpOrUnixPath;
    } else {
        if (hostWithIpOrUnixPath.includes(':')) {
            const [host, port] = hostWithIpOrUnixPath.split(':');
            if (host) parsedHost.host = host;
            if (port) parsedHost.port = parseInt(port, 10);
        } else {
            if (hostWithIpOrUnixPath) parsedHost.host = hostWithIpOrUnixPath;
        }
    }

    return parsedHost
}
