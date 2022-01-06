import { BenchSuite } from '../../bench';
import { pack, Processor, ReflectionOp, typeOf } from '@deepkit/type';

export async function main() {
    const suite = new BenchSuite('process');

    const processor = new Processor();
    processor.run([ReflectionOp.number], []);
    processor.run([ReflectionOp.number, ReflectionOp.string, ReflectionOp.union], []);

    function newArray<T>(init: T, items: number): T[] {
        const a: T[] = [];
        for (let i = 0; i < items; i++) {
            a.push(init);
        }
        return a;
    }

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

    var __Ωo = ['a', 'b', 'c', 'P&4!\'4")4#M']; //{a: string, b: number, c: boolean}

    suite.add('construct object', () => {
        const type = typeOf([], [() => __Ωo, 'n!']);
    });

    var __ΩPartial = ['T', 'l+e#!e"!fRb!Pde"!gN#"']; //global Partial<T>
    suite.add('Partial<Object>', () => {
        const type = typeOf([], [() => __ΩPartial, () => __Ωo, 'n"o!"']);
    });

    var __ΩStringToNum = ['T', 'A', 'length', 'length', 0, 0, 'l9e#".$fRe#!Pe$"@.&Go%#Rb!PGc"PPe#".#fSe"!qk#*Q'];
    suite.add('typeOf complex StringToNum 100', () => {
        const type = typeOf([], [() => __ΩStringToNum, '100', '."o!"']);
    });

    const external = pack([ReflectionOp.string]);
    suite.add('extern call', () => {
        processor.run([ReflectionOp.inline, 0], [external]);
        external.__type = undefined;
    });

    suite.run();
}
