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
import { isComputedPropertyName, isIdentifier, isNumericLiteral, isPrivateIdentifier, isStringLiteral, ModifiersArray, SyntaxKind } from 'typescript';


export function getNameAsString(node?: Identifier | StringLiteral | NumericLiteral | ComputedPropertyName | PrivateIdentifier): string {
    if (!node) return '';
    if (isIdentifier(node)) return node.escapedText as string;
    if (isStringLiteral(node)) return node.text;
    if (isNumericLiteral(node)) return node.text;
    if (isComputedPropertyName(node)) return node.getText();
    if (isPrivateIdentifier(node)) return node.text;
    return '';
}

export function hasModifier(node: { modifiers?: ModifiersArray }, modifier: SyntaxKind): boolean {
    if (!node.modifiers) return false;
    return node.modifiers.some(v => v.kind === modifier);
}
