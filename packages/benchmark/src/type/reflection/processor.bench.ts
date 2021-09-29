import { BenchSuite } from '../../bench';
import { Processor, ReflectionOp } from '@deepkit/type';

export async function main() {
    const suite = new BenchSuite('process');

    // suite.add('simple', () => {
    //     executeType([ReflectionOp.number], []);
    // });
    //
    // suite.add('union', () => {
    //     executeType([ReflectionOp.number, ReflectionOp.string, ReflectionOp.union], []);
    // });
    //
    // suite.add('call', () => {
    //     executeType([ReflectionOp.jump, 4, ReflectionOp.string, ReflectionOp.return, ReflectionOp.call, 2], []);
    // });

    const processor = new Processor;
    processor.run([ReflectionOp.number], []);
    processor.run([ReflectionOp.number, ReflectionOp.string, ReflectionOp.union], []);

    suite.add('simple', () => {
        processor.run([ReflectionOp.number], []);
    });

    // suite.add('simple 2', () => {
    //     processor.run([ReflectionOp.string, ReflectionOp.number], []);
    // });

    suite.add('union', () => {
        processor.run([ReflectionOp.union], []);
    });

    suite.add('function', () => {
        processor.run([ReflectionOp.number, ReflectionOp.string, ReflectionOp.void, ReflectionOp.function], []);
    });

    suite.add('call', () => {
        processor.run([ReflectionOp.jump, 4, ReflectionOp.string, ReflectionOp.return, ReflectionOp.call, 2], []);
    });

    suite.run();
}
