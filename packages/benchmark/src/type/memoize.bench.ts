import { BenchSuite } from '../bench';

const memoize = require('memoizee');


function memoizeWithJIT(fn: Function, options: { stackSize: number } = { stackSize: 10 }): Function {
    const stacks: string[] = [];
    const variables: string[] = [];
    const argNames: string[] = [];
    for (let a = 0; a < fn.length; a++) {
        argNames.push('arg' + a);
    }

    for (let i = 0; i < options.stackSize; i++) {
        const stack = 'stack' + i;
        variables.push(stack);
        const argsCheck: string[] = [];

        for (let a = 0; a < fn.length; a++) {
            argsCheck.push(`${argNames[a]} === ${stack}.arg${a}`);
        }

        stacks.push(`
        case (!${stack} || (${argsCheck.join(' && ')})): {
            if (!${stack}) {
                ${stack} = {${argNames.join(',')}, result: fn(${argNames.join(',')})};
            }
            return ${stack}.result;
        }
        `);
    }

    const code = `
    'use strict';
    var ${variables.join(', ')};

    return function(${argNames.join(', ')}) {
        'use strict';
        switch (true) {
            ${stacks.join('\n')}
        }

        //here could be other linked memoizeWithJIT() calls
        //or in worst case a array/hashmap lookup
        return fn(${argNames.join(',')});
    }
    `;

    console.log('code', code);

    return new Function('fn', code)(fn);
}

export async function main() {
    const suite = new BenchSuite('memoize');

    //coped from https://github.com/medikoo/memoizee/issues/27
    function fn(value, leftMin, leftMax, rightMin, rightMax) {
        var leftSpan = leftMax - leftMin;
        var rightSpan = rightMax - rightMin;

        var scaled = (value - leftMin) / leftSpan;
        return rightMin + scaled * rightSpan;
    }

    const memoized = memoize(fn, { primitive: true });
    const memoizedJit = memoizeWithJIT(fn);

    suite.add('memoize', () => {
        if (memoized(0, 0, 10, 10, 100) !== 10) throw new Error('Wrong result');
    });

    // console.log('memoizedJit', memoizedJit.toString());
    suite.add('memoize jit', () => {
        if (memoizedJit(0, 0, 10, 10, 100) !== 10) throw new Error('Wrong result jit');
    });

    // console.log('memoizedJit', memoizedJit.toString());
    suite.add('naked', () => {
        if (fn(0, 0, 10, 10, 100) !== 10) throw new Error('Wrong result jit');
    });

    suite.run();
}
