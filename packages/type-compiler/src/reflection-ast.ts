/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    ArrowFunction,
    BinaryExpression,
    ComputedPropertyName,
    EntityName,
    Expression,
    Identifier,
    ImportSpecifier,
    isArrowFunction,
    isComputedPropertyName,
    isIdentifier,
    isNumericLiteral,
    isPrivateIdentifier,
    isStringLiteral,
    JSDoc,
    ModifiersArray,
    Node,
    NodeArray,
    NodeFactory,
    NodeFlags,
    NumericLiteral,
    PrivateIdentifier,
    PropertyAccessExpression,
    QualifiedName,
    StringLiteral,
    SymbolTable,
    SyntaxKind,
    unescapeLeadingUnderscores
} from 'typescript';
import { isArray } from '@deepkit/core';
import { cloneNode as tsNodeClone, CloneNodeHook } from 'ts-clone-node';
import { SourceFile } from './ts-types';

export type PackExpression = Expression | string | number | boolean | bigint;

export function getIdentifierName(node: Identifier | PrivateIdentifier): string {
    return unescapeLeadingUnderscores(node.escapedText);
}

export function joinQualifiedName(name: EntityName): string {
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
    if (isComputedPropertyName(node)) return '';
    if (isPrivateIdentifier(node)) return getIdentifierName(node);

    return joinQualifiedName(node);
}

export function hasModifier(node: { modifiers?: ModifiersArray }, modifier: SyntaxKind): boolean {
    if (!node.modifiers) return false;
    return node.modifiers.some(v => v.kind === modifier);
}

const cloneHook = <T extends Node>(node: T, payload: { depth: number }): CloneNodeHook<T> | undefined => {
    if (isIdentifier(node)) {
        //ts-clone-node wants to read `node.text` which does not exist. we hook into into an provide the correct value.
        return {
            text: () => {
                return getIdentifierName(node);
            }
        } as any;
    }
    return;
}

export class NodeConverter {
    constructor(protected f: NodeFactory) {
    }

    toExpression<T extends PackExpression | PackExpression[]>(value?: T): Expression {
        if (value === undefined) return this.f.createIdentifier('undefined');

        if (isArray(value)) {
            return this.f.createArrayLiteralExpression(this.f.createNodeArray(value.map(v => this.toExpression(v))) as NodeArray<Expression>);
        }

        if ('string' === typeof value) return this.f.createStringLiteral(value, true);
        if ('number' === typeof value) return this.f.createNumericLiteral(value);
        if ('bigint' === typeof value) return this.f.createBigIntLiteral(String(value));
        if ('boolean' === typeof value) return value ? this.f.createTrue() : this.f.createFalse();

        if (value.pos === -1 && value.end === -1 && value.parent === undefined) {
            if (isArrowFunction(value)) {
                if (value.body.pos === -1 && value.body.end === -1 && value.body.parent === undefined) return value;
                return this.f.createArrowFunction(value.modifiers, value.typeParameters, value.parameters, value.type, value.equalsGreaterThanToken, this.toExpression(value.body as Expression));
            }
            return value;
        }

        try {
            return tsNodeClone(value, {
                preserveComments: false,
                factory: this.f,
                setOriginalNodes: true,
                preserveSymbols: true,
                setParents: true,
                hook: cloneHook
            }) as Expression;
        } catch (error) {
            console.log('value', value);
            throw error;
        }
    }
}

function isExternalOrCommonJsModule(file: SourceFile): boolean {
    //both attributes are internal and not yet public
    return (file.externalModuleIndicator || file.commonJsModuleIndicator) !== undefined;
}

export function isNodeWithLocals(node: Node): node is (Node & { locals: SymbolTable | undefined }) {
    return 'locals' in node;
}

export function getGlobalsOfSourceFile(file: SourceFile): SymbolTable | void {
    if (file.redirectInfo) return;
    if (!isNodeWithLocals(file)) return;
    if (!isExternalOrCommonJsModule(file)) return file.locals;
    if (file.jsGlobalAugmentations) return file.jsGlobalAugmentations;
    if (file.symbol && file.symbol.globalExports) return file.symbol.globalExports;
}

/**
 * For imports that can removed (like a class import only used as type only, like `p: Model[]`) we have
 * to modify the import so TS does not remove it.
 */
export function ensureImportIsEmitted(importSpecifier?: ImportSpecifier) {
    if (importSpecifier) {
        //make synthetic. Let the TS compiler keep this import
        (importSpecifier.flags as any) |= NodeFlags.Synthesized;
    }
}


/**
 * Serializes an entity name as an expression for decorator type metadata.
 *
 * @param node The entity name to serialize.
 */
export function serializeEntityNameAsExpression(f: NodeFactory, node: EntityName): SerializedEntityNameAsExpression {
    switch (node.kind) {
        case SyntaxKind.Identifier:
            return tsNodeClone(node, {
                factory: f,
                preserveComments: false,
                setOriginalNodes: true,
                preserveSymbols: true,
                setParents: true,
                hook: cloneHook
            });
        case SyntaxKind.QualifiedName:
            return serializeQualifiedNameAsExpression(f, node);
    }
}

type SerializedEntityNameAsExpression = Identifier | BinaryExpression | PropertyAccessExpression;

/**
 * Serializes an qualified name as an expression for decorator type metadata.
 *
 * @param node The qualified name to serialize.
 * @param useFallback A value indicating whether to use logical operators to test for the
 *                    qualified name at runtime.
 */
function serializeQualifiedNameAsExpression(f: NodeFactory, node: QualifiedName): SerializedEntityNameAsExpression {
    return f.createPropertyAccessExpression(serializeEntityNameAsExpression(f, node.left), node.right);
}
