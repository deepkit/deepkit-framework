/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import type {
    ArrowFunction,
    BigIntLiteral,
    BinaryExpression,
    ComputedPropertyName,
    EntityName,
    Expression,
    Identifier,
    ImportDeclaration,
    JSDoc,
    ModifierLike,
    Node,
    NodeArray,
    NodeFactory,
    NumericLiteral,
    PrivateIdentifier,
    PropertyAccessExpression,
    QualifiedName,
    StringLiteral,
    StringLiteralLike,
    SymbolTable,
} from 'typescript';
import ts from 'typescript';
import { cloneNode as tsNodeClone, CloneNodeHook } from '@marcj/ts-clone-node';
import { SourceFile } from './ts-types.js';

const {
    isArrowFunction,
    isComputedPropertyName,
    isIdentifier,
    isNamedImports,
    isNumericLiteral,
    isPrivateIdentifier,
    isStringLiteral,
    isStringLiteralLike,
    setOriginalNode,
    NodeFlags,
    SyntaxKind
} = ts;

export type PackExpression = Expression | string | number | boolean | bigint;

export function getIdentifierName(node: Identifier | PrivateIdentifier): string {
    return ts.unescapeLeadingUnderscores(node.escapedText);
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
            if (getIdentifierName(tag.tagName) === attribute && 'string' === typeof tag.comment) return tag.comment;
        }
    }

    return '';
}

export function getPropertyName(f: NodeFactory, node?: Identifier | StringLiteral | NumericLiteral | ComputedPropertyName | PrivateIdentifier): string | symbol | number | ArrowFunction {
    if (!node) return '';

    if (isIdentifier(node)) return getIdentifierName(node);
    if (isStringLiteral(node)) return node.text;
    if (isNumericLiteral(node)) return +node.text;
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
    if (isComputedPropertyName(node)) {
        if (isStringLiteralLike(node) || isNumericLiteral(node)) return (node as StringLiteralLike | NumericLiteral).text;
        return '';
    }
    if (isPrivateIdentifier(node)) return getIdentifierName(node);

    return joinQualifiedName(node);
}

export function hasModifier(node: { modifiers?: NodeArray<ModifierLike> }, modifier: ts.SyntaxKind): boolean {
    if (!node.modifiers) return false;
    return node.modifiers.some(v => v.kind === modifier);
}

const cloneHook = <T extends Node>(node: T, payload: { depth: number }): CloneNodeHook<T> | undefined => {
    if (isIdentifier(node)) {
        //ts-clone-node wants to read `node.text` which does not exist. we hook into it and provide the correct value.
        return {
            text: () => {
                return getIdentifierName(node);
            }
        } as any;
    }
    return;
};

export class NodeConverter {
    constructor(protected f: NodeFactory) {}

    toExpression<T extends PackExpression | PackExpression[]>(node?: T): Expression {
        if (node === undefined) return this.f.createIdentifier('undefined');

        if (Array.isArray(node)) {
            return this.f.createArrayLiteralExpression(this.f.createNodeArray(node.map(v => this.toExpression(v))) as NodeArray<Expression>);
        }

        if ('string' === typeof node) return this.f.createStringLiteral(node, true);
        if ('number' === typeof node) return this.f.createNumericLiteral(node);
        if ('bigint' === typeof node) return this.f.createBigIntLiteral(String(node));
        if ('boolean' === typeof node) return node ? this.f.createTrue() : this.f.createFalse();

        if (node.pos === -1 && node.end === -1 && node.parent === undefined) {
            if (isArrowFunction(node)) {
                if (node.body.pos === -1 && node.body.end === -1 && node.body.parent === undefined) return node;
                return this.f.createArrowFunction(node.modifiers, node.typeParameters, node.parameters, node.type, node.equalsGreaterThanToken, this.toExpression(node.body as Expression));
            }
            return node;
        }

        switch (node.kind) {
            case SyntaxKind.Identifier:
                return finish(node, this.f.createIdentifier(getIdentifierName(node as Identifier)));
            case SyntaxKind.StringLiteral:
                return finish(node, this.f.createStringLiteral((node as StringLiteral).text));
            case SyntaxKind.NumericLiteral:
                return finish(node, this.f.createNumericLiteral((node as NumericLiteral).text));
            case SyntaxKind.BigIntLiteral:
                return finish(node, this.f.createBigIntLiteral((node as BigIntLiteral).text));
            case SyntaxKind.TrueKeyword:
                return finish(node, this.f.createTrue());
            case SyntaxKind.FalseKeyword:
                return finish(node, this.f.createFalse());
        }

        //todo: ts-node-clone broke with ts 4.8,
        // => TypeError: Cannot read properties of undefined (reading 'emitNode')
        // which is probably due a broken node clone. We need to figure out which node it is
        // and see what the issue is. since ts-node-clone is not really maintained anymore,
        // we need to fork it
        try {
            return tsNodeClone(node, {
                preserveComments: false,
                factory: this.f,
                setOriginalNodes: true,
                preserveSymbols: true,
                setParents: true,
                hook: cloneHook
            }) as Expression;
        } catch (error) {
            console.error('could not clone node', node);
            throw error;
        }

    }
}

function isExternalOrCommonJsModule(file: SourceFile): boolean {
    //both attributes are internal and not yet public
    return (file.externalModuleIndicator || file.commonJsModuleIndicator) !== undefined;
}

export function isBuiltType(typeVar: Identifier, sourceFile: SourceFile): boolean {
    return isNodeWithLocals(sourceFile) && !!sourceFile.locals?.has(typeVar.escapedText);
}

export function isNodeWithLocals(node: Node): node is (Node & { locals: SymbolTable | undefined }) {
    return 'locals' in node;
}

export function getEntityName(typeName: EntityName): string {
    return isIdentifier(typeName)
        ? getIdentifierName(typeName)
        : getIdentifierName(typeName.right);
}

//logic copied from typescript
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
export function ensureImportIsEmitted(importDeclaration: ImportDeclaration, specifierName?: Identifier) {
    if (specifierName && importDeclaration.importClause && importDeclaration.importClause.namedBindings) {
        // const binding = importDeclaration.importClause.namedBindings;
        if (isNamedImports(importDeclaration.importClause.namedBindings)) {
            for (const element of importDeclaration.importClause.namedBindings.elements) {
                if (element.name.escapedText === specifierName.escapedText) {
                    (element.flags as any) |= NodeFlags.Synthesized;
                    return;
                }
            }
        }
    }

    (importDeclaration.flags as any) |= NodeFlags.Synthesized;
}


/**
 * Serializes an entity name as an expression for decorator type metadata.
 *
 * @param node The entity name to serialize.
 */
export function serializeEntityNameAsExpression(f: NodeFactory, node: EntityName): SerializedEntityNameAsExpression {
    switch (node.kind) {
        case SyntaxKind.Identifier:
            return finish(node, f.createIdentifier(getIdentifierName(node)));
        case SyntaxKind.QualifiedName:
            return finish(node, serializeQualifiedNameAsExpression(f, node));
    }
    return node;
}

export type SerializedEntityNameAsExpression = Identifier | BinaryExpression | PropertyAccessExpression;

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

export type MetaNode = Node & {
    jsDoc?: JSDoc[];
    _original?: MetaNode;
    original?: MetaNode;
    _symbol?: Symbol;
    symbol?: Symbol;
    _parent?: MetaNode;
    localSymbol?: Symbol;
};

function finish<T extends MetaNode>(oldNode: MetaNode, newNode: T): T {
    setOriginalNode(newNode, oldNode);
    newNode._original = newNode.original;

    newNode._symbol = oldNode._symbol ?? oldNode.symbol;
    newNode.symbol = newNode._symbol;
    return newNode;
}

