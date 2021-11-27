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
    SyntaxKind,
    unescapeLeadingUnderscores
} from 'typescript';

export function getIdentifierName(node: Identifier | PrivateIdentifier): string {
    return unescapeLeadingUnderscores(node.escapedText);
}

function joinQualifiedName(name: EntityName): string {
    if (isIdentifier(name)) return getIdentifierName(name);
    return joinQualifiedName(name.left) + '_' + getIdentifierName(name.right);
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

    if (isIdentifier(node)) return getIdentifierName(node);
    if (isStringLiteral(node)) return node.text;
    if (isNumericLiteral(node)) return node.text;
    if (isComputedPropertyName(node)) {
        return f.createArrowFunction(undefined, undefined, [], undefined, undefined, node.expression);
    }
    if (isPrivateIdentifier(node)) return getIdentifierName(node);

    return '';
}

export function getNameAsString(node?: Identifier | StringLiteral | NumericLiteral | ComputedPropertyName | PrivateIdentifier | QualifiedName): string {
    if (!node) return '';
    if (isIdentifier(node)) return getIdentifierName(node);
    if (isStringLiteral(node)) return node.text;
    if (isNumericLiteral(node)) return node.text;
    if (isComputedPropertyName(node)) return node.getText();
    if (isPrivateIdentifier(node)) return getIdentifierName(node);

    return joinQualifiedName(node);
}

export function hasModifier(node: { modifiers?: ModifiersArray }, modifier: SyntaxKind): boolean {
    if (!node.modifiers) return false;
    return node.modifiers.some(v => v.kind === modifier);
}
