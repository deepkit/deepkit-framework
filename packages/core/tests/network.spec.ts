import { expect, test } from '@jest/globals';
import { parseHost } from '../src/network';

test('parseHost', () => {
    {
        const parsed = parseHost('aosdad');
        expect(parsed.isUnixSocket).toBe(false);
        expect(parsed.isHostname).toBe(true);
        expect(parsed.host).toBe('aosdad');
        expect(parsed.hostWithIp).toBe('aosdad');
    }

    {
        const parsed = parseHost('aosdad:80');
        expect(parsed.isUnixSocket).toBe(false);
        expect(parsed.isHostname).toBe(true);
        expect(parsed.host).toBe('aosdad');
        expect(parsed.port).toBe(80);
        expect(parsed.hostWithIp).toBe('aosdad:80');
        expect(parsed.getWebSocketUrl(false)).toBe('ws://aosdad:80');
        expect(parsed.getWebSocketUrl(true)).toBe('wss://aosdad:80');
        expect(parsed.getHttpUrl(false)).toBe('http://aosdad:80');
        expect(parsed.getHttpUrl(true)).toBe('https://aosdad:80');
    }

    {
        const parsed = parseHost(':80');
        expect(parsed.isUnixSocket).toBe(false);
        expect(parsed.isHostname).toBe(true);
        expect(parsed.host).toBe('127.0.0.1');
        expect(parsed.port).toBe(80);
        expect(parsed.hostWithIp).toBe('127.0.0.1:80');
    }

    {
        const parsed = parseHost(':');
        expect(parsed.isUnixSocket).toBe(false);
        expect(parsed.isHostname).toBe(true);
        expect(parsed.host).toBe('127.0.0.1');
        expect(parsed.port).toBe(0);
        expect(parsed.hostWithIp).toBe('127.0.0.1');
    }

    {
        const parsed = parseHost('');
        expect(parsed.isUnixSocket).toBe(false);
        expect(parsed.isHostname).toBe(true);
        expect(parsed.host).toBe('127.0.0.1');
        expect(parsed.port).toBe(0);
        expect(parsed.hostWithIp).toBe('127.0.0.1');
    }
    {
        const parsed = parseHost('localhost:');
        expect(parsed.isUnixSocket).toBe(false);
        expect(parsed.isHostname).toBe(true);
        expect(parsed.host).toBe('localhost');
        expect(parsed.port).toBe(0);
        expect(parsed.hostWithIp).toBe('localhost');
    }

    {
        const parsed = parseHost('./unix-path');
        expect(parsed.isUnixSocket).toBe(true);
        expect(parsed.isHostname).toBe(false);
        expect(parsed.unixSocket).toBe('./unix-path');
    }

    {
        const parsed = parseHost('unix-path.sock');
        expect(parsed.isUnixSocket).toBe(true);
        expect(parsed.isHostname).toBe(false);
        expect(parsed.unixSocket).toBe('unix-path.sock');
        expect(parsed.getWebSocketUrl(false)).toBe('ws+unix://unix-path.sock');
        expect(parsed.getWebSocketUrl(true)).toBe('wss+unix://unix-path.sock');
        expect(parsed.getHttpUrl(false)).toBe('file://unix-path.sock');
        expect(parsed.getHttpUrl(true)).toBe('file://unix-path.sock');
    }

    {
        const parsed = parseHost('\\windoze\\unix-path.sock');
        expect(parsed.isUnixSocket).toBe(true);
        expect(parsed.isHostname).toBe(false);
        expect(parsed.unixSocket).toBe('\\windoze\\unix-path.sock');
    }
});
