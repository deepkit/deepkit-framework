import { benchmark, run } from '@deepkit/bench';

// ASCII binary parsing example
const binaryString = Buffer.from('Hello World', 'utf8');
const codePoints = binaryString.toJSON().data;

benchmark('Buffer.toString', () => {
    const utf8String = binaryString.toString('utf8');
});

benchmark('Buffer.toString with encoding', () => {
    const utf8String = String.fromCharCode.apply(String, codePoints);
});

void run();
