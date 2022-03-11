import { test } from '@jest/globals';
import '../src/optimize-tsx';

Error.stackTraceLimit = 200;

test('template test', async () => {
    // console.dir(parseCode(`'a' + props.children + 'b'`), { depth: null });
    // console.dir(parseCode(`'a' + this.children + 'b'`), { depth: null });
    // console.dir(parseCode(`jsx.safe('a')`), { depth: null });
    // console.dir(parseCode(`['a', 'b']`), { depth: null });
    // console.dir(parseCode(`const a = { '\x00s': 'a' }`), { depth: null });
    // console.dir(parseCode(`const a = { [jsx.safeString]: 'a' }`), { depth: null });
    // console.dir(parseCode(`const a = escape(e)`), { depth: null });
    // console.dir(parseCode(`const a = escape(e).safeHtml`), { depth: null });

    // console.dir(parseCode(`'a' + children + 'b'`), { depth: null });
    // console.dir(parseCode(`const a = {a: b}`), { depth: null });
    // console.dir(generateCode({ type: 'Identifier', name: 'assd'}), { depth: null });
    // console.dir(generateCode({ type: 'ArrayPattern', elements: [{ type: 'Identifier', name: 'a'}, { type: 'Identifier', name: 'b'}]}), { depth: null });
    // console.dir(parseCode(`html('asd')`), { depth: null });
    // console.dir(parseCode(`html(\`asd\`)`), { depth: null });
    // console.dir(parseCode(`html(\`asd \${3} \`)`), { depth: null });
    // console.dir(parseCode(`variable + '23' + 23;`), { depth: null });
    // console.log(test1.toString());
    // console.log(JSON.stringify(tree.parse('_jsx.createElement("div", {}, void 0)')));
});
