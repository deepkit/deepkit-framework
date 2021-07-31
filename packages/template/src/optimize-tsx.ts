/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { addHook } from 'pirates';
import {
    ArrayExpression,
    ArrayPattern,
    AssignmentPattern,
    BinaryExpression,
    CallExpression,
    Expression,
    Identifier,
    Literal,
    MemberExpression,
    Node,
    ObjectExpression,
    ObjectPattern,
    Property,
    RestElement,
    SpreadElement,
    UnaryExpression
} from 'estree';
// @ts-ignore
import abstractSyntaxTree from 'abstract-syntax-tree';
import { inDebugMode } from '@deepkit/core';
import { escape } from './utils';

const { parse, generate, replace } = abstractSyntaxTree;

export function transform(code: string, filename: string) {
    if (inDebugMode()) return code;
    //for CommonJs its jsx_runtime_1.jsx, for ESM its _jsx. ESM is handled in loader.ts#transformSource
    if (code.indexOf('.jsx(') === -1 && code.indexOf('.jsxs(') === -1) return code;
    console.log('optimize code for', filename, optimizeJSX(code));
    return optimizeJSX(code);
}

addHook(transform, { exts: ['.js', '.tsx'] });

class NotSerializable {
}

export function parseCode(code: string) {
    return parse(code);
}

export function generateCode(ast: Node) {
    return generate(ast);
}

function serializeValue(node: Literal | UnaryExpression): any {
    if (node.type === 'Literal') {
        return node.value;
    }

    if (node.type === 'UnaryExpression' && node.argument?.type === 'Literal') {
        return node.argument.value;
    }

    return NotSerializable;
}

/**
 * Our strategy is to convert ObjectExpressions to a BinaryExpression that has basically like
 *
 *      p1 + '=' + p1Value + ' ' + p2 + '=' + p2Value + ...
 *
 * concatExpressions() can then further optimise it down to one big literal (or several literals depending on where non-literals are used).
 */
function optimizeAttributes(jsxRuntime: string, node: ObjectExpression): any {
    const expressions: ConcatableType[] = [];

    for (const p of node.properties) {
        if (p.type === 'SpreadElement') return node;
        if (isPattern(p.value)) return node;

        const value = p.value.type === 'UnaryExpression' ? p.value.argument : p.value;

        if (expressions.length) {
            expressions.push(createEscapedLiteral(' '));
        }
        if (p.key.type === 'Identifier') {
            expressions.push(createEscapedLiteral(p.key.name));
        } else {
            expressions.push(p.key);
        }
        expressions.push(createEscapedLiteral('="'));

        if (value.type !== 'Literal' && !isPattern(value) && !isCreateElementCall(value) && !isEscapeCall(value) && !isHtmlCall(value)) {
            expressions.push(toEscapeAttributeCall(jsxRuntime, value));
        } else {
            if (value.type === 'Literal') {
                expressions.push(createEscapedLiteral(value.value));
            } else {
                expressions.push(value);
            }
        }
        expressions.push(createEscapedLiteral('"'));
    }

    if (expressions.length >= 2) return concatExpressions(jsxRuntime, expressions);
    return createEscapedLiteral('');
}

function isPattern(e: Node): e is ObjectPattern | ArrayPattern | RestElement | AssignmentPattern | MemberExpression {
    return e.type === 'ArrayPattern' || e.type === 'ObjectPattern' || e.type === 'AssignmentPattern' || e.type === 'RestElement' || e.type === 'MemberExpression';
}

function isCjsJSXCall(node: any): boolean {
    return node.type === 'CallExpression' && (node.callee.property?.name === 'jsx' || node.callee.property?.name === 'jsxs');
}

function isESMJSXCall(node: any): boolean {
    return node.type === 'CallExpression' && (node.callee.name === '_jsx' || node.callee.name === '_jsxs');
}

/**
 * We convert
 *
 * _jsx.createElement("div", { id: "123" }, void 0)
 * -> "<div id=\"123\"></div>"
 *
 * _jsx.createElement("div", { children: "Test" }, void 0)
 * -> "<div>Test</div>"
 *
 * _jsx.createElement("div", Object.assign({ id: "123" }, { children: "Test" }), void 0)
 * -> "<div id=\"123\">Test</div>"
 *
 * _jsx.createElement("div", Object.assign({ id: "123" }, { children: _jsx.createElement('b", { children: "strong' }, void 0) }), void 0);
 * -> "<div id=\"123\">" + "<b>strong</b>" + "</div>"
 */
function optimizeNode(node: Expression, asHtml: boolean = true): Expression {
    if (node.type !== 'CallExpression') return node;
    if (node.callee.type !== 'MemberExpression') return node;
    if (node.callee.object.type !== 'Identifier') return node;

    const isCreateElementExpression = node.callee.property.type === 'Identifier' && node.callee.property?.name === 'createElement';
    if (!isCreateElementExpression) return node;

    const jsxRuntime = node.callee.object.name;

    //if first argument is a Fragment, we optimise for that
    if (node.arguments[0].type === 'MemberExpression' && node.arguments[0].object.type === 'Identifier'
        && node.arguments[0].property.type === 'Identifier' && node.arguments[0].property.name === 'Fragment') {
        //we normalize Fragments (or all createElement(var)) to have as second parameter the attributes.
        //since Fragments don't have attributes, this is always an empty object, so we skip that

        const concat: Expression[] = [];
        let optimisedString: boolean = true;
        let strings: string[] = [];
        for (let i = 2; i < node.arguments.length; i++) {
            const a = node.arguments[i];
            if (a && a.type !== 'SpreadElement') {
                const o = optimizeNode(a, false);
                concat.push(o);
                const staticString = extractStaticString(o);
                if (staticString !== noStaticValue) {
                    strings.push(staticString);
                } else {
                    optimisedString = false;
                }
            }
        }
        if (optimisedString) {
            //all arguments are string literals, which can merge to one big string
            return createEscapedLiteral(strings.join(''));
        }
        return concatExpressions(jsxRuntime, concat);
    }

    //go deeper if possible
    for (let i = 2; i < node.arguments.length; i++) {
        const a = node.arguments[i];
        if (a && a.type === 'CallExpression') {
            node.arguments[i] = optimizeNode(a);
        }
    }

    let tag: any = '';
    //we only optimize attributes when we have createElement(string)
    if (node.arguments[0].type === 'Literal') {
        tag = node.arguments[0].value;

        const attributes = node.arguments[1];

        if (isObjectAssignCall(attributes)) {
            //when we have here Object.assign still, then it includes a spread operator, which we can't optimise.
            return node;
        } else {
            if (node.arguments[1] && node.arguments[1].type === 'ObjectExpression') {
                const ori = node.arguments[1];
                node.arguments[1] = optimizeAttributes(jsxRuntime, ori);
                if (ori === node.arguments[1]) {
                    //we did not change the attributes to a better option, so we stop optimizing further.
                    return node;
                }
            }
        }
    }

    //check if we can concatenate (+) arguments
    let canBeConcatenated = true;
    for (let i = 1; i < node.arguments.length; i++) {
        const a = node.arguments[i];
        if (a && a.type !== 'SpreadElement' && !isConcatenatable(a)) {
            canBeConcatenated = false;
            break;
        }
    }

    if (canBeConcatenated) {
        const args = node.arguments as (Literal | CallExpression)[];
        const attributes = args[1];

        const concat: Expression[] = [];
        if (tag) {
            if (attributes.type === 'Literal' && !attributes.value) {
                //no attributes
                concat.push(createEscapedLiteral('<' + tag + '>'));
            } else {
                concat.push(createEscapedLiteral('<' + tag + ' '));
                concat.push(attributes);
                concat.push(createEscapedLiteral('>'));
            }
        }

        for (let i = 2; i < node.arguments.length; i++) {
            let e = node.arguments[i];
            if (e && e.type !== 'SpreadElement') {
                if (e.type === 'Literal') {
                    e.value = escape('' + e.value);
                }
                if (e.type !== 'Literal' && !isCreateElementCall(e) && !isRenderObject(e) && !isChildren(e) && !isEscapeCall(e) && !isHtmlCall(e)) {
                    e = toEscapeCall(jsxRuntime, e);
                }
                concat.push(e);
            }
        }

        if (tag) {
            concat.push(createEscapedLiteral('</' + tag + '>'));
        }

        if (concat.length === 0) {
            return node;
        }

        if (node.arguments[0].type !== 'Literal') {
            //for custom elements, we only merge its arguments
            if (node.arguments[2]) {
                if (concat.length >= 2) {
                    node.arguments[2] = concatExpressions(jsxRuntime, concat);
                    node.arguments.splice(3);
                }
            }
            return node;
        }

        //concatExpressions tries to convert everything to one big literal if possible
        //alternatively returns an renderObject expression with array children.
        const compressed = concatExpressions(jsxRuntime, concat);
        return asHtml && !isRenderObject(compressed) ? toHtmlCall(jsxRuntime, compressed) : compressed;
    }

    return node;
}

function createRenderObjectWithEscapedChildren(children?: Expression, render: Expression = { type: 'Identifier', name: 'undefined' }, attributes: Expression = {
    type: 'Identifier',
    name: 'undefined'
}): Expression {
    const o: ObjectExpression = {
        type: 'ObjectExpression',
        properties: [
            {
                type: 'Property',
                key: { type: 'Identifier', name: 'render' },
                value: render,
                kind: 'init',
                computed: false,
                method: false,
                shorthand: false
            },
            {
                type: 'Property',
                key: { type: 'Identifier', name: 'attributes' },
                value: attributes,
                kind: 'init',
                computed: false,
                method: false,
                shorthand: false
            }
        ]
    };

    if (children) {
        o.properties.push({
            type: 'Property',
            key: { type: 'Identifier', name: 'childrenEscaped' },
            value: children,
            kind: 'init',
            computed: false,
            method: false,
            shorthand: false
        });
    }

    return o;
}

function isRenderObject(e: Node) {
    return e.type === 'ObjectExpression' && e.properties[0] && e.properties[0].type === 'Property'
        && e.properties[0].key.type === 'Identifier' && e.properties[0].key.name === 'render'
        ;
}

function isObjectAssignCall(e: Node) {
    return e.type === 'CallExpression' && e.callee.type === 'MemberExpression'
        && e.callee.object.type === 'Identifier' && e.callee.object.name === 'Object'
        && e.callee.property.type === 'Identifier' && e.callee.property.name === 'assign'
        ;
}

function createEscapedLiteral(v: string | number | boolean | null | RegExp | undefined): Literal {
    return { type: 'Literal', value: v, escape: true } as any;
}

function isEscapedLiteral(e: Node): boolean {
    return e.type === 'Literal' && (e as any).escaped === true;
}

function isCreateElementCall(e: Node) {
    return e.type === 'CallExpression' && e.callee.type === 'MemberExpression'
        && e.callee.object.type === 'Identifier'
        && e.callee.property.type === 'Identifier' && e.callee.property.name === 'createElement';
}

function isConcatenatable(e: Expression): boolean {
    return extractStaticString(e) !== undefined || e.type === 'Identifier';
}

function toHtmlCall(jsxRuntime: string, expression: Expression): CallExpression {
    return {
        type: 'CallExpression',
        callee: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: jsxRuntime },
            computed: false,
            optional: false,
            property: { type: 'Identifier', name: 'html' }
        },
        optional: false,
        arguments: [expression]
    };
}

function toEscapeCall(jsxRuntime: string, expression: Expression): CallExpression {
    return {
        type: 'CallExpression',
        callee: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: jsxRuntime },
            computed: false,
            optional: false,
            property: { type: 'Identifier', name: 'escape' }
        },
        optional: false,
        arguments: [expression]
    };
}

function toEscapeAttributeCall(jsxRuntime: string, expression: Expression): CallExpression {
    return {
        type: 'CallExpression',
        callee: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: jsxRuntime },
            computed: false,
            optional: false,
            property: { type: 'Identifier', name: 'escapeAttribute' }
        },
        optional: false,
        arguments: [expression]
    };
}

export const noStaticValue: unique symbol = Symbol('');

export function extractStaticString(e: Expression | SpreadElement): string | typeof noStaticValue {
    if (e.type === 'Literal') return '' + e.value;
    if (e.type === 'TemplateLiteral' && e.expressions.length === 0) {
        return e.quasis.map(v => v.value.cooked).join('');
    }

    const htmlCallArg = getHtmlCallArg(e);
    if (htmlCallArg) {
        return extractStaticString(htmlCallArg);
    }

    return noStaticValue;
}

function unwrapSpread(e: Expression | SpreadElement): Expression {
    return e.type === 'SpreadElement' ? e.argument : e;
}

function isHtmlCall(object: Expression | SpreadElement): boolean {
    return getHtmlCallArg(object) !== undefined;
}

function getHtmlCallArg(e: Expression | SpreadElement): Expression | undefined {
    if (e.type === 'CallExpression' && e.callee.type === 'MemberExpression'
        && e.callee.object.type === 'Identifier' && e.callee.object.name === '_jsx'
        && e.callee.property.type === 'Identifier' && e.callee.property.name === 'html'
        && e.arguments[0]) return unwrapSpread(e.arguments[0]);

    if (e.type === 'CallExpression' && e.callee.type === 'MemberExpression'
        && e.callee.object.type === 'Identifier'
        && e.callee.property.type === 'Identifier' && e.callee.property.name === 'html'
        && e.arguments[0]) return unwrapSpread(e.arguments[0]);

    if (e.type === 'CallExpression' && e.callee.type === 'Identifier' && e.callee.name === 'html' && e.arguments[0]) {
        return unwrapSpread(e.arguments[0]);
    }

    return;
}

function isChildren(e: Expression | SpreadElement): boolean {
    if (e.type === 'MemberExpression' && (e.object.type === 'Identifier' || e.object.type === 'ThisExpression')
        && e.property.type === 'Identifier' && e.property.name === 'children') return true;

    if (e.type === 'Identifier' && e.name === 'children') {
        return true;
    }

    return false;
}

function isEscapeCall(e: Expression | SpreadElement): boolean {
    return e.type === 'CallExpression' && e.callee.type === 'MemberExpression'
        && e.callee.object.type === 'Identifier'
        && e.callee.property.type === 'Identifier'
        && (e.callee.property.name === 'escape' || e.callee.property.name === 'escapeAttribute')
        ;
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

type ConcatableType = Expression | Identifier;

function concatExpressions(jsxRuntime: string, expressions: ConcatableType[]): ConcatableType {
    if (expressions.length < 2) {
        console.dir(expressions, { depth: null });
        throw new Error('concatExpressions requires at least 2 expressions');
    }

    const normalizedExpressions: ConcatableType[] = [];

    for (let e of expressions) {
        const htmlArg = getHtmlCallArg(e);
        if (htmlArg) e = htmlArg;

        if (e.type === 'BinaryExpression') {
            //unwrap existing binaryExpression to avoid brackets: a + (b + (c + d)) + e
            for (const a of extractBinaryExpressions(e)) {
                normalizedExpressions.push(a);
            }
        } else {
            normalizedExpressions.push(e);
        }
    }

    let optimizedExpressions: ConcatableType[] = [];
    let lastLiteral: Literal | undefined;

    //try to optimise static values together
    for (const e of normalizedExpressions) {
        const value = extractStaticString(e);
        if (value === noStaticValue) {
            lastLiteral = undefined;
            optimizedExpressions.push(e);
        } else {
            if (lastLiteral) {
                lastLiteral.value += value;
            } else {
                lastLiteral = createEscapedLiteral(value);
                optimizedExpressions.push(lastLiteral);
            }
        }
    }

    let lastBinaryExpression: BinaryExpression | undefined;

    if (optimizedExpressions.length === 1) {
        return optimizedExpressions[0];
    }

    for (const e of optimizedExpressions) {
        if (isCreateElementCall(e) || isChildren(e) || isRenderObject(e)) {
            //we can't optimise this as one big binary expression
            //we have to return it as array
            const arrayExpression: ArrayExpression = {
                type: 'ArrayExpression',
                elements: [],
            };
            for (let e of optimizedExpressions) {
                arrayExpression.elements.push(e);
            }
            return createRenderObjectWithEscapedChildren(arrayExpression);
        }
    }

    for (let i = 1; i < optimizedExpressions.length; i++) {
        lastBinaryExpression = {
            type: 'BinaryExpression',
            left: lastBinaryExpression || optimizedExpressions[0],
            right: optimizedExpressions[i],
            operator: '+',
        };
    }

    if (!lastBinaryExpression) throw new Error('Could not build binary expression');

    return lastBinaryExpression;
}

function extractBinaryExpressions(e: BinaryExpression, expressions?: Expression[]): Expression[] {
    expressions ||= [];

    if (e.left.type === 'BinaryExpression') {
        extractBinaryExpressions(e.left, expressions);
    } else {
        expressions.push(e.left);
    }

    if (e.right.type === 'BinaryExpression') {
        extractBinaryExpressions(e.right, expressions);
    } else {
        expressions.push(e.right);
    }

    return expressions;
}

/**
 * We convert .jsx/.jsxs back to createElement syntax to have one optimization syntax.
 * createElement is used by TSX as well as fallback when `<div {...props} something=123>` is used.
 *
 *
 * _jsx("div", { id: "123" }, void 0)
 * -> _jsx.createElement("div", {id: "123"}}
 *
 * _jsx("div", { children: "Test" }, void 0)
 * -> _jsx.createElement("div", {}, "Test")
 *
 * _jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0)
 * -> _jsx.createElement("div", {id: "123"}, "Test"}
 *
 * _jsx("div", Object.assign({ id: "123" }, { children: _jsx('b", { children: "strong' }, void 0) }), void 0);
 * -> _jsx.createElement("div", {id: "123"}, _jsx.createElement("b", {}, "strong"))
 */
function convertNodeToCreateElement(node: Expression): Expression {
    if (node.type !== 'CallExpression') return node;
    const isCJS = isCjsJSXCall(node);
    const isESM = isESMJSXCall(node);

    if (!isCJS && !isESM) return node;

    if (isESM) {
        //rewrite to _jsx.createElement
        node.callee = {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: '_jsx' },
            computed: false,
            property: { type: 'Identifier', name: 'createElement' }
        } as MemberExpression;
    } else {
        if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') node.callee.property.name = 'createElement';
    }

    node.arguments.splice(2); //remove void 0

    if (!node.arguments[1]) return node;

    if (node.arguments[1].type === 'CallExpression' && node.arguments[1].callee.type === 'MemberExpression' && node.arguments[1].callee.object.type === 'Identifier' && node.arguments[1].callee.object.name === 'Object') {
        //Object.assign(), means we have 2 entries, one with attributes, and second with `children`
        // Object.assign({id: 123}, {children: "Test"}) or
        // Object.assign({}, props, { id: "123" }, { children: "Test" })
        const objectAssignsArgs = node.arguments[1].arguments;
        const lastArgument = objectAssignsArgs[objectAssignsArgs.length - 1];

        if (lastArgument.type !== 'ObjectExpression') throw new Error(`Expect ObjectExpression, got ${JSON.stringify(lastArgument)}`);

        const children = extractChildrenFromObjectExpressionProperties(lastArgument.properties);
        if (children) {
            if (children.type === 'ArrayExpression') {
                node.arguments.push(...children.elements.map(v => convertNodeToCreateElement(v as Expression)));
            } else {
                node.arguments.push(convertNodeToCreateElement(children));
            }
        }

        if (objectAssignsArgs.length > 2) {
            //remove last
            objectAssignsArgs.splice(objectAssignsArgs.length - 1, 1);
        } else {
            if (objectAssignsArgs[0].type === 'ObjectExpression') {
                node.arguments[1] = { type: 'ObjectExpression', properties: objectAssignsArgs[0].properties };
            }
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

export function optimizeJSX(code: string): string {
    const tree = parse(code);

    replace(tree, (node: any) => {
        if (isESMJSXCall(node) || isCjsJSXCall(node)) {
            return optimizeNode(convertNodeToCreateElement(node), false);
        }
        return node;
    });

    return generate(tree);
}

export function convertJsxCodeToCreateElement(code: string): string {
    const tree = parse(code);

    replace(tree, (node: any) => {

        if (isESMJSXCall(node) || isCjsJSXCall(node)) {
            return convertNodeToCreateElement(node);
        }
        return node;
    });

    return generate(tree);
}
