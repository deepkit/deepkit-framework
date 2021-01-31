import { BenchSuite } from "../bench";

export async function main() {

    const buffer = new Uint8Array(128);
    new Uint32Array(buffer)[0] = 54567;

    const suite = new BenchSuite('parse size');

    suite.add('DataView', async () => {
        new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(0, true)
    });

    const offset = 0;
    suite.add('buffer[0]', async () => {
        const size = buffer[offset] + (buffer[offset + 1] * 2 ** 8) + (buffer[offset + 1] * 2 ** 16) + (buffer[offset + 3] * 2 ** 24);
    });

    suite.run();
}