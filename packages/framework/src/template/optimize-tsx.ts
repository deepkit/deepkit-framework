/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {addHook} from 'pirates';
import {Expression, Literal, Property, SpreadElement} from 'estree';

function transform(code: string, filename: string) {
    if (code.indexOf('.jsx(') === -1 && code.indexOf('.jsxs(') === -1) return code;
    const optimized = optimize(code);
    // console.log('optimized tsx', filename, optimized);
    return optimized;
}

addHook(transform, {exts: ['.js', '.tsx']});

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
    let value: string[] = [];

    for (const prop of node.properties) {
        const canOptimized = (prop.key.type === 'Identifier' || prop.key.type === 'Literal');
        const serializedValue = serializeValue(prop.value);
        if (!canOptimized || serializedValue === NotSerializable) {
            return node;
        }
        value.push(prop.key.name + '="' + serializedValue + '"');
    }

    return {type: 'Literal', value: value.join(' ')};
}

/**
 *
 * We convert
 *
 * jsx_runtime_1.jsx("div", { id: "123" }, void 0)
 * -> "<div id=\"123\"></div>"
 *
 * jsx_runtime_1.jsx("div", { children: "Test" }, void 0)
 * -> "<div>Test</div>"
 *
 * jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0)
 * -> "<div id=\"123\">Test</div>"
 *
 * jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: jsx_runtime_1.jsx("b", { children: "strong" }, void 0) }), void 0);
 * -> "<div id=\"123\">" + "<b>strong</b>" + "</div>"
 *
 */
function optimizeNode(node: Expression): any {
    if (node.type !== 'CallExpression') return node;
    const isCreateElementExpression = node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier' && node.callee.property?.name === 'createElement';
    if (!isCreateElementExpression) return node;

    //go deeper if possible
    for (let i = 2; i < node.arguments.length; i++) {
        const a = node.arguments[i];
        if (a && a.type === 'CallExpression') {
            node.arguments[i] = optimizeNode(a);
        }
    }

    //can we serialize/optimize attributes?
    //we only optimize attributes when we have createElement(string)
    if (node.arguments[0].type !== 'Literal') return node;

    if (node.arguments[1] && node.arguments[1].type === 'ObjectExpression') {
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
        const args = node.arguments as Literal[];

        const tag = args[0].value;
        let value = '<' + tag + (args[1] && args[1].value ? (' ' + args[1].value) : '') + '>';

        for (let i = 2; i < node.arguments.length; i++) {
            if (node.arguments[i] === undefined || node.arguments[i] === null) {
                value += node.arguments[i];
            } else {
                value += args[i].value;
                if (args[i].value === undefined) {
                    // console.error('Shit', node.arguments[i]);
                }
            }
        }
        value += '</' + tag + '>';
        return {type: 'Literal', value: value};
    }

    return node;
}

function extractChildrenFromObjectExpressionProperties(props: Array<Property | SpreadElement>): Expression | undefined {
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.key.name === 'children') {
            props.splice(i, 1);
            return prop.value as Expression;
        }
    }
    return;
}

/**
 * We convert .jsx/.jsxs back to createElement syntax to have one optimization syntax.
 * createElement is used by TSX as well as fallback when `<div {...props} something=123>` is used.
 *
 *
 * jsx_runtime_1.jsx("div", { id: "123" }, void 0)
 * -> jsx_runtime_1.createElement("div", {id: "123"}}
 *
 * jsx_runtime_1.jsx("div", { children: "Test" }, void 0)
 * -> jsx_runtime_1.createElement("div", {}, "Test")
 *
 * jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0)
 * -> jsx_runtime_1.createElement("div", {id: "123"}, "Test"}
 *
 * jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: jsx_runtime_1.jsx("b", { children: "strong" }, void 0) }), void 0);
 * -> jsx_runtime_1.createElement("div", {id: "123"}, jsx_runtime_1.createElement("b", {}, "strong"))
 */
function convertNodeToCreateElement(node: Expression): Expression {
    if (node.type !== 'CallExpression') return node;

    if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') node.callee.property.name = 'createElement';

    node.arguments.splice(2); //remove void 0

    if (!node.arguments[1]) return node;

    if (node.arguments[1].type === 'CallExpression' && node.arguments[1].callee.type === 'MemberExpression' && node.arguments[1].callee.object.type === 'Identifier' && node.arguments[1].callee.object.name === 'Object') {
        //Object.assign(), means we have 2 entries, one with attributes, and second with `children`
        const objectAssignsArgs = node.arguments[1].arguments;

        if (objectAssignsArgs[1].type === 'ObjectExpression') {
            const children = extractChildrenFromObjectExpressionProperties(objectAssignsArgs[1].properties);
            if (children) {
                if (children.type === 'ArrayExpression') {
                    node.arguments.push(...children.elements.map(v => convertNodeToCreateElement(v as Expression)));
                } else {
                    node.arguments.push(convertNodeToCreateElement(children));
                }
            }
        }

        if (objectAssignsArgs[0].type === 'ObjectExpression') {
            node.arguments[1] = {type: 'ObjectExpression', properties: objectAssignsArgs[0].properties};
        }
    } else if (node.arguments[1].type === 'ObjectExpression') {
        //simple {}
        const children = extractChildrenFromObjectExpressionProperties(node.arguments[1].properties);

        if (children) {
            if (children.type === 'ArrayExpression') {
                node.arguments.push(...children.elements.map(v => convertNodeToCreateElement(v as Expression)));
            } else {
                node.arguments.push(convertNodeToCreateElement(children));
            }
        }
    }

    return node;
}

export function optimize(code: string): string {
    const tree = parse(code);

    replace(tree, (node: any) => {
        if (node.type === 'CallExpression' && (node.callee.property?.name === 'jsx' || node.callee.property?.name === 'jsxs')) {
            try {
                return optimizeNode(convertNodeToCreateElement(node));
            } catch (error) {
                console.log('failed optimize template node', error);
                console.log('node:', node);
                return node;
            }
        }
        return node;
    });

    return generate(tree);
}


export function convertJsxCodeToCreateElement(code: string): string {
    const tree = parse(code);

    replace(tree, (node: any) => {
        if (node.type === 'CallExpression' && (node.callee.property?.name === 'jsx' || node.callee.property?.name === 'jsxs')) {
            try {
                return convertNodeToCreateElement(node);
            } catch (error) {
                console.log('failed optimize template node', error);
                console.log('node:', node);
                return node;
            }
        }
        return node;
    });

    return generate(tree);
}
