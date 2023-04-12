import { BenchSuite } from '../bench.js';
import { createHash } from 'crypto';

function bufToBigint(buf: Buffer): bigint {
    let ret = 0n;
    for (let i = 0; i < buf.byteLength; i++) {
        ret = (ret << 8n) + BigInt(buf[i]);
    }
    return ret;
}

export function main() {
    const bench = new BenchSuite('map');
    const hash = createHash('sha256').update('12312313').digest();
    const hex = hash.toString('hex');
    const b = BigInt('0x' + hex);

    bench.add('bigint create from hex', () => {
        const b2 = BigInt('0x' + hex);
    });

    bench.add('bigint create from buffer', () => {
        const b2 = BigInt('0x' + hash.toString('hex'));
    });

    bench.add('bigint create from buffer 2', () => {
        const b2 = bufToBigint(hash);
    });

    bench.add('bigint equal', () => {
        const e = b === 2332332n;
    });

    const other = new Uint8Array([123, 123, 21, 123]);
    bench.add('buffer equal', () => {
        const e = hash.equals(other);
    });

    bench.add('bigint to hex', () => {
        b.toString(16);
    });

    bench.add('buffer to hex', () => {
        hash.toString('hex');
    });

    bench.run();
}
