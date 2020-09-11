import {template} from './template';

const {parse, generate, replace} = require('abstract-syntax-tree');

class NotSerializable {
}

function serializeValue(node: any): any {
    if (node.type === 'Literal') {
        return node.value;
    }

    if (node.type === 'UnaryExpression' && node.argument?.type === 'Literal') {
        return node.argument.value;
    }

    return NotSerializable;
}

function optimizeAttributes(node: any) {
    let value: string = '';
    for (const prop of node.properties) {
        const canOptimized = (prop.key.type === 'Identifier' || prop.key.type === 'Literal');
        const serializedValue = serializeValue(prop.value);
        if (!canOptimized || serializedValue === NotSerializable) {
            console.error('can not optimize', prop);
            return node;
        }
        value = ' ' + prop.key.name + '="' + serializedValue + '"';
    }

    return {type: 'Literal', value: value};
}

function optimizeNode(node: any) {
    const isCreateElementExpression = node.type === 'CallExpression' && node.callee.property?.name === 'createElement';
    if (!isCreateElementExpression) return node;

    //go deeper if possible
    for (let i = 2; i < node.arguments.length; i++) {
        if (node.arguments[i] && node.arguments[i].type === 'CallExpression') {
            node.arguments[i] = optimizeNode(node.arguments[i]);
        }
    }

    //can we serialize attributes?
    if (node.arguments[0].type === 'Literal' && node.arguments[1] && node.arguments[1].type === 'ObjectExpression') {
        node.arguments[1] = optimizeAttributes(node.arguments[1]);
    }

    //check if we can consolidate arguments to one big string
    //todo: consolidate all possible groups instead of 'all-or-nothing'.
    let canBeReplaced = true;
    for (let i = 2; i < node.arguments.length; i++) {
        if (node.arguments[i] && node.arguments[i].type !== 'Literal') {
            canBeReplaced = false;
            break;
        }
    }

    if (canBeReplaced) {
        const tag = node.arguments[0].value;
        let value = '<' + tag + ' ' + (node.arguments[1].value ?? '') + '>';
        for (let i = 2; i < node.arguments.length; i++) {
            if (node.arguments[i] === undefined || node.arguments[i] === null) {
                value += node.arguments[i];
            } else {
                value += node.arguments[i].value;
                if (node.arguments[i].value === undefined) {
                    // console.error('Shit', node.arguments[i]);
                }
            }
        }
        value += '</' + tag + '>';
        return {type: 'Literal', value: value};
    }

    return node;
}

export function optimizeFunction(fn: Function): Function {
    const optimized = optimize(fn.toString());

    return new Function('template', 'return ' + optimized)(template);
}

export function optimize(code: string): string {
    const tree = parse(code);

    // console.log('tree', tree.body);
    // replace(tree, (node: any) => {
    //     if (node.type === 'MemberExpression' && node.property.name === 'createElement') {
    //         // console.log('ma', node);
    //         // node.callee.object = {type: 'Identifier', name: 'template'};
    //         return {
    //             type: 'MemberExpression',
    //             object: {type: 'Identifier', name: 'template'},
    //             computed: false,
    //             property: {type: 'Identifier', name: 'createElement'}
    //         };
    //     }
    //     return node;
    // });

    replace(tree, (node: any) => {
        if (node.type === 'CallExpression' && node.callee.property?.name === 'createElement') {
            try {
                return optimizeNode(node);
            } catch (error) {
                console.log('failed optimize template node', error);
                console.log('node:', node);
                return node;
            }
        }
        return node;
    });

    // code = code.replace('')

    // console.log('code', generate(tree));
    return generate(tree);
}