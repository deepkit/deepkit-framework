/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ComputedPropertyName, Identifier, NumericLiteral, PrivateIdentifier, StringLiteral } from 'typescript/lib/tsserverlibrary';
import {
    ArrowFunction,
    EntityName,
    isComputedPropertyName,
    isIdentifier,
    isNumericLiteral,
    isPrivateIdentifier,
    isStringLiteral,
    JSDoc,
    ModifiersArray,
    Node,
    NodeFactory,
    QualifiedName,
    SyntaxKind
} from 'typescript';

function joinQualifiedName(name: EntityName): string {
    if (isIdentifier(name)) return name.text;
    return joinQualifiedName(name.left) + '_' + name.right.text;
}

function hasJsDoc(node: any): node is { jsDoc: JSDoc[]; } {
    return 'jsDoc' in node && !!(node as any).jsDoc;
}

export function extractJSDocAttribute(node: Node, attribute: string): string {
    if (!hasJsDoc(node)) return '';

    for (const doc of node.jsDoc) {
        if (!doc.tags) continue;
        for (const tag of doc.tags) {
            if (tag.tagName.text === attribute && 'string' === typeof tag.comment) return tag.comment;
        }
    }

    return '';
}

export function getPropertyName(f: NodeFactory, node?: Identifier | StringLiteral | NumericLiteral | ComputedPropertyName | PrivateIdentifier): string | ArrowFunction {
    if (!node) return '';

    if (isIdentifier(node)) return node.text;
    if (isStringLiteral(node)) return node.text;
    if (isNumericLiteral(node)) return node.text;
    if (isComputedPropertyName(node)) {
        return f.createArrowFunction(undefined, undefined, [], undefined, undefined, node.expression);
    }
    if (isPrivateIdentifier(node)) return node.text;

    return '';
}

export function getNameAsString(node?: Identifier | StringLiteral | NumericLiteral | ComputedPropertyName | PrivateIdentifier | QualifiedName): string {
    if (!node) return '';
    if (isIdentifier(node)) return node.text;
    if (isStringLiteral(node)) return node.text;
    if (isNumericLiteral(node)) return node.text;
    if (isComputedPropertyName(node)) return node.getText();
    if (isPrivateIdentifier(node)) return node.text;

    return joinQualifiedName(node);
}

export function hasModifier(node: { modifiers?: ModifiersArray }, modifier: SyntaxKind): boolean {
    if (!node.modifiers) return false;
    return node.modifiers.some(v => v.kind === modifier);
}
