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
    __String,
    ArrayTypeNode,
    ArrowFunction,
    BigIntLiteral,
    Bundle,
    ClassDeclaration,
    ClassElement,
    ClassExpression,
    ConditionalTypeNode,
    ConstructorDeclaration,
    createCompilerHost,
    createProgram,
    CustomTransformerFactory,
    Declaration,
    EntityName,
    EnumDeclaration,
    ExportDeclaration,
    Expression,
    FunctionDeclaration,
    FunctionExpression,
    FunctionTypeNode,
    getEffectiveConstraintOfTypeParameter,
    getJSDocTags,
    ImportCall,
    ImportDeclaration,
    ImportEqualsDeclaration,
    ImportSpecifier,
    ImportTypeNode,
    IndexedAccessTypeNode,
    IndexSignatureDeclaration,
    InferTypeNode,
    InterfaceDeclaration,
    IntersectionTypeNode,
    isArrayTypeNode,
    isArrowFunction,
    isCallExpression,
    isClassDeclaration,
    isClassExpression,
    isConstructorDeclaration,
    isEnumDeclaration,
    isExportDeclaration,
    isFunctionDeclaration,
    isFunctionExpression,
    isIdentifier,
    isImportSpecifier,
    isInterfaceDeclaration,
    isMappedTypeNode,
    isMethodDeclaration,
    isNamedExports,
    isNamedTupleMember,
    isOptionalTypeNode,
    isParenthesizedTypeNode,
    isStringLiteral,
    isTypeAliasDeclaration,
    isTypeLiteralNode,
    isTypeReferenceNode,
    LiteralTypeNode,
    MappedTypeNode,
    MethodDeclaration,
    ModifierFlags,
    ModuleDeclaration,
    Node,
    NodeFactory,
    NodeFlags,
    NumericLiteral,
    PropertyAccessExpression,
    PropertyDeclaration,
    PropertySignature,
    QualifiedName,
    RestTypeNode,
    ScriptReferenceHost,
    SourceFile,
    Statement,
    StringLiteral,
    SymbolTable,
    SyntaxKind,
    TransformationContext,
    TupleTypeNode,
    TypeAliasDeclaration,
    TypeChecker,
    TypeElement,
    TypeLiteralNode,
    TypeOperatorNode,
    TypeReferenceNode,
    UnionTypeNode,
    visitEachChild,
    visitNode,
} from 'typescript';
import { isArray } from '@deepkit/core';
import { extractJSDocAttribute, getNameAsString, getPropertyName, hasModifier } from './reflection-ast';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import stripJsonComments from 'strip-json-comments';
import { MappedModifier, ReflectionOp, TypeNumberBrand } from './type';

export const packSizeByte: number = 6;

/**
 * It can't be more ops than this given number
 */
export const packSize: number = 2 ** packSizeByte; //64

type StackEntry = Expression | string | number | boolean;
type PackExpression = Expression | string | number | boolean | bigint;

interface PackStruct {
    ops: ReflectionOp[],
    stack: PackExpression[]
}

/**
 * An internal helper that has not yet exposed to transformers.
 */
interface EmitResolver {
    // getReferencedValueDeclaration(reference: Identifier): Declaration | undefined;

    // getReferencedImportDeclaration(nodeIn: Identifier): Declaration | undefined;

    getExternalModuleFileFromDeclaration(declaration: ImportEqualsDeclaration | ImportDeclaration | ExportDeclaration | ModuleDeclaration | ImportTypeNode | ImportCall): SourceFile | undefined;
}

const reflectionModes = ['always', 'default', 'never'] as const;

const OPs: { [op in ReflectionOp]?: { params: number } } = {
    [ReflectionOp.literal]: { params: 1 },
    // [ReflectionOp.pointer]: { params: 1 },
    // [ReflectionOp.arg]: { params: 1 },
    [ReflectionOp.classReference]: { params: 1 },
    [ReflectionOp.propertySignature]: { params: 1 },
    [ReflectionOp.property]: { params: 1 },
    [ReflectionOp.jump]: { params: 1 },
    [ReflectionOp.enum]: { params: 1 },
    [ReflectionOp.template]: { params: 1 },
    [ReflectionOp.mappedType]: { params: 2 },
    [ReflectionOp.call]: { params: 1 },
    [ReflectionOp.inline]: { params: 1 },
    [ReflectionOp.inlineCall]: { params: 2 },
    [ReflectionOp.loads]: { params: 2 },
    [ReflectionOp.infer]: { params: 2 },
    [ReflectionOp.defaultValue]: { params: 1 },
    [ReflectionOp.parameter]: { params: 1 },
    [ReflectionOp.method]: { params: 1 },
    [ReflectionOp.description]: { params: 1 },
    [ReflectionOp.numberBrand]: { params: 1 },
};

export function debugPackStruct(pack: { ops: ReflectionOp[], stack: PackExpression[] }): void {
    const items: any[] = [];

    for (let i = 0; i < pack.ops.length; i++) {
        const op = pack.ops[i];
        const opInfo = OPs[op];
        items.push(ReflectionOp[op]);
        // items.push(op);
        if (opInfo && opInfo.params > 0) {
            for (let j = 0; j < opInfo.params; j++) {
                const address = pack.ops[++i];
                items.push(address);
            }
        }
    }

    console.log(pack.stack, '|', ...items);
}

/**
 * Pack a pack structure (op instructions + pre-defined stack) and create a encoded version of it.
 */
export function pack(packOrOps: PackStruct | ReflectionOp[]): PackExpression[] {
    const ops = isArray(packOrOps) ? packOrOps : packOrOps.ops;
    const encodedOps = ops.map(v => String.fromCharCode(v + 33)).join('');

    if (!isArray(packOrOps)) {
        if (packOrOps.stack.length) {
            return [...packOrOps.stack as StackEntry[], encodedOps];
        }
    }

    return [encodedOps];
}

function isNodeWithLocals(node: Node): node is (Node & { locals: SymbolTable | undefined }) {
    return 'locals' in node;
}

interface Frame {
    variables: { name: string, index: number }[],
    opIndex: number;
    conditional?: true;
    previous?: Frame;
}

function findVariable(frame: Frame, name: string, frameOffset: number = 0): { frameOffset: number, stackIndex: number } | undefined {
    const variable = frame.variables.find(v => v.name === name);
    if (variable) {
        return { frameOffset, stackIndex: variable.index };
    }

    if (frame.previous) return findVariable(frame.previous, name, frameOffset + 1);

    return;
}

function findConditionalFrame(frame: Frame): Frame | undefined {
    if (frame.conditional) return frame;
    if (frame.previous) return findConditionalFrame(frame.previous);

    return;
}

class CompilerProgram {
    protected ops: ReflectionOp[] = [];
    protected stack: StackEntry[] = [];
    protected mainOffset: number = 0;

    protected stackPosition: number = 0;

    protected frame: Frame = { variables: [], opIndex: 0 };

    protected activeCoRoutines: { ops: ReflectionOp[] }[] = [];
    protected coRoutines: { ops: ReflectionOp[] }[] = [];

    constructor(public forNode: Node) {
    }

    buildPackStruct() {
        const ops: ReflectionOp[] = [...this.ops];

        if (this.coRoutines.length) {
            for (let i = this.coRoutines.length - 1; i >= 0; i--) {
                ops.unshift(...this.coRoutines[i].ops);
            }
        }

        if (this.mainOffset) {
            ops.unshift(ReflectionOp.jump, this.mainOffset);
        }

        return { ops, stack: this.stack };
    }

    isEmpty(): boolean {
        return this.ops.length === 0;
    }

    pushConditionalFrame(): void {
        const frame = this.pushFrame();
        frame.conditional = true;
    }

    pushStack(item: StackEntry): number {
        this.stack.push(item);
        return this.stackPosition++;
    }

    pushCoRoutine(): void {
        this.pushFrame(true); //co-routines have implicit stack frames due to call convention
        this.activeCoRoutines.push({ ops: [] });
    }

    popCoRoutine(): number {
        const coRoutine = this.activeCoRoutines.pop();
        if (!coRoutine) throw new Error('No active co routine found');
        this.popFrame();
        if (this.mainOffset === 0) {
            this.mainOffset = 2; //we add JUMP + index when building the program
        }
        const startIndex = this.mainOffset;
        coRoutine.ops.push(ReflectionOp.return);
        this.coRoutines.push(coRoutine);
        this.mainOffset += coRoutine.ops.length;
        return startIndex;
    }

    pushOp(...ops: ReflectionOp[]): void {
        if (this.activeCoRoutines.length) {
            this.activeCoRoutines[this.activeCoRoutines.length - 1].ops.push(...ops);
            return;
        }

        this.ops.push(...ops);
    }

    pushOpAtFrame(frame: Frame, ...ops: ReflectionOp[]): void {
        if (this.activeCoRoutines.length) {
            this.activeCoRoutines[this.activeCoRoutines.length - 1].ops.splice(frame.opIndex, 0, ...ops);
            return;
        }

        this.ops.splice(frame.opIndex, 0, ...ops);
    }

    /**
     * Returns the index of the `entry` in the stack, if already exists. If not, add it, and return that new index.
     */
    findOrAddStackEntry(entry: any): number {
        const index = this.stack.indexOf(entry);
        if (index !== -1) return index;
        return this.pushStack(entry);
    }

    /**
     * To make room for a stack entry expected on the stack as input for example.
     */
    increaseStackPosition(): number {
        return this.stackPosition++;
    }

    pushFrame(implicit: boolean = false) {
        if (!implicit) this.pushOp(ReflectionOp.frame);
        const opIndex = this.activeCoRoutines.length ? this.activeCoRoutines[this.activeCoRoutines.length - 1].ops.length : this.ops.length;
        this.frame = { previous: this.frame, variables: [], opIndex };
        return this.frame;
    }

    findConditionalFrame() {
        return findConditionalFrame(this.frame);
    }

    popFrame() {
        if (this.frame.previous) this.frame = this.frame.previous;
    }

    pushVariable(name: string, frame: Frame = this.frame): number {
        this.pushOpAtFrame(frame, ReflectionOp.var);
        frame.variables.push({
            index: this.frame.variables.length,
            name,
        });
        return frame.variables.length - 1;
    }

    pushTemplateParameter(name: string): number {
        this.pushOp(ReflectionOp.template, this.findOrAddStackEntry(name));
        this.frame.variables.push({
            index: this.frame.variables.length,
            name,
        });
        return this.frame.variables.length - 1;
    }

    findVariable(name: string) {
        return findVariable(this.frame, name);
    }
}

/**
 * Read the TypeScript AST and generate pack struct (instructions + pre-defined stack).
 *
 * This transformer extracts type and add the encoded (so its small and low overhead) at classes and functions as property.
 *
 * Deepkit/type can then extract and decode them on-demand.
 */
export class ReflectionTransformer {
    sourceFile!: SourceFile;
    protected host!: ScriptReferenceHost;
    protected resolver!: EmitResolver;
    protected f: NodeFactory;

    protected reflectionMode?: typeof reflectionModes[number];

    constructor(
        protected context: TransformationContext,
    ) {
        this.f = context.factory;
        this.host = (context as any).getEmitHost() as ScriptReferenceHost;
        this.resolver = (context as any).getEmitResolver() as EmitResolver;
    }

    protected getTypeCheckerForSource(): TypeChecker {
        const sourceFile: SourceFile = this.sourceFile;
        if ((sourceFile as any)._typeChecker) return (sourceFile as any)._typeChecker;
        const host = createCompilerHost(this.context.getCompilerOptions());
        const program = createProgram([sourceFile.fileName], this.context.getCompilerOptions(), { ...host, ...this.host });
        return (sourceFile as any)._typeChecker = program.getTypeChecker();
    }

    withReflectionMode(mode: typeof reflectionModes[number]): this {
        this.reflectionMode = mode;
        return this;
    }

    transformBundle(node: Bundle): Bundle {
        return node;
    }

    transformSourceFile(sourceFile: SourceFile): SourceFile {
        this.sourceFile = sourceFile;
        const reflection = this.findReflectionConfig(sourceFile);
        if (reflection.mode === 'never') {
            return sourceFile;
        }

        const visitor = (node: Node): any => {
            node = visitEachChild(node, visitor, this.context);

            if (isClassDeclaration(node)) {
                return this.decorateClass(node);
            } else if (isClassExpression(node)) {
                return this.decorateClass(node);
            } else if (isFunctionExpression(node)) {
                return this.decorateFunctionExpression(node);
            } else if (isFunctionDeclaration(node)) {
                return this.decorateFunctionDeclaration(node);
            } else if (isArrowFunction(node)) {
                return this.decorateArrow(node);
            } else if (isCallExpression(node) && node.typeArguments) {
                const autoTypeFunctions = ['valuesOf', 'propertiesOf', 'typeOf'];
                if (isIdentifier(node.expression) && autoTypeFunctions.includes(node.expression.text)) {
                    const args: Expression[] = [...node.arguments];

                    if (!args.length) {
                        args.push(this.f.createArrayLiteralExpression());
                    }

                    // const resolvedType = this.resolveType(node.typeArguments[0]);
                    const type = this.getTypeOfType(node.typeArguments[0]);
                    if (!type) return node;
                    args.push(type);

                    return this.f.updateCallExpression(node, node.expression, node.typeArguments, this.f.createNodeArray(args));
                } else {
                    // const typeChecker = this.getTypeCheckerForSource();
                    // const symbol = typeChecker.getSymbolAtLocation(node.expression);
                    const found = this.resolveDeclaration(node.expression);
                    const type = found && found.declaration;
                    if (type && isFunctionDeclaration(type) && type.typeParameters) {
                        const args: Expression[] = [...node.arguments];
                        let replaced = false;

                        for (let i = 0; i < type.parameters.length; i++) {
                            // for (const parameter of type.valueDeclaration.parameters) {
                            const parameter = type.parameters[i];
                            if (!args[i]) {
                                args[i] = this.f.createIdentifier('undefined');
                            }
                            if (parameter.type && isTypeReferenceNode(parameter.type) && isIdentifier(parameter.type.typeName)
                                && parameter.type.typeName.text === 'ReceiveType' && parameter.type.typeArguments) {
                                const first = parameter.type.typeArguments[0];
                                if (first && isTypeReferenceNode(first) && isIdentifier(first.typeName)) {
                                    const name = first.typeName.text;
                                    //find type parameter position
                                    const index = type.typeParameters.findIndex(v => v.name.text === name);
                                    if (index !== -1) {
                                        const type = this.getTypeOfType(node.typeArguments[index]);
                                        if (!type) return node;
                                        args[i] = type;
                                        replaced = true;
                                    }
                                }
                            }
                        }

                        if (replaced) {
                            return this.f.updateCallExpression(node, node.expression, node.typeArguments, this.f.createNodeArray(args));
                        }
                    }
                }
                return node;
            }

            return node;
        };
        this.sourceFile = visitNode(this.sourceFile, visitor);

        //externalize type aliases
        const compileDeclarations = (node: Node): any => {
            node = visitEachChild(node, compileDeclarations, this.context);

            if ((isTypeAliasDeclaration(node) || isInterfaceDeclaration(node) || isEnumDeclaration(node)) && this.compileDeclarations.has(node)) {
                const d = this.compileDeclarations.get(node)!;
                this.compileDeclarations.delete(node);
                this.compiledDeclarations.add(node);
                return [node, this.createProgramVarFromNode(node, d.name)];
            }

            return node;
        };

        while (this.compileDeclarations.size > 0) {
            this.sourceFile = visitNode(this.sourceFile, compileDeclarations);
        }

        if (this.embedDeclarations.size) {
            const embeded: Statement[] = [];
            for (const node of this.embedDeclarations.keys()) {
                this.compiledDeclarations.add(node);
            }
            for (const [node, d] of this.embedDeclarations.entries()) {
                embeded.push(this.createProgramVarFromNode(node, d.name));
            }
            return this.f.updateSourceFile(this.sourceFile, [...embeded, ...this.sourceFile.statements],
                this.sourceFile.isDeclarationFile, this.sourceFile.referencedFiles, this.sourceFile.typeReferenceDirectives, this.sourceFile.hasNoDefaultLib,
                this.sourceFile.libReferenceDirectives
            );
        }

        return this.sourceFile;
    }

    protected createProgramVarFromNode(node: Node, name: EntityName) {
        const typeProgram = new CompilerProgram(node);

        if ((isTypeAliasDeclaration(node) || isInterfaceDeclaration(node)) && node.typeParameters) {
            for (const param of node.typeParameters) {
                typeProgram.pushTemplateParameter(param.name.text);
            }
        }
        if (isTypeAliasDeclaration(node)) {
            this.extractPackStructOfType(node.type, typeProgram);
        } else {
            this.extractPackStructOfType(node, typeProgram);
        }
        const typeProgramExpression = this.packOpsAndStack(typeProgram.buildPackStruct());

        return this.f.createVariableStatement(
            undefined,
            this.f.createVariableDeclarationList([
                this.f.createVariableDeclaration(
                    this.getDeclarationVariableName(name),
                    undefined,
                    undefined,
                    typeProgramExpression,
                )
            ])
        );
    }

    protected extractPackStructOfType(node: Node | Declaration | ClassDeclaration | ClassExpression, program: CompilerProgram): void {
        if (isParenthesizedTypeNode(node)) return this.extractPackStructOfType(node.type, program);

        switch (node.kind) {
            case SyntaxKind.StringKeyword: {
                program.pushOp(ReflectionOp.string);
                break;
            }
            case SyntaxKind.NumberKeyword: {
                program.pushOp(ReflectionOp.number);
                break;
            }
            case SyntaxKind.BooleanKeyword: {
                program.pushOp(ReflectionOp.boolean);
                break;
            }
            case SyntaxKind.BigIntKeyword: {
                program.pushOp(ReflectionOp.bigint);
                break;
            }
            case SyntaxKind.VoidKeyword: {
                program.pushOp(ReflectionOp.void);
                break;
            }
            case SyntaxKind.SymbolKeyword: {
                program.pushOp(ReflectionOp.symbol);
                break;
            }
            case SyntaxKind.NullKeyword: {
                program.pushOp(ReflectionOp.null);
                break;
            }
            case SyntaxKind.NeverKeyword: {
                program.pushOp(ReflectionOp.never);
                break;
            }
            case SyntaxKind.AnyKeyword: {
                program.pushOp(ReflectionOp.any);
                break;
            }
            case SyntaxKind.UndefinedKeyword: {
                program.pushOp(ReflectionOp.undefined);
                break;
            }
            case SyntaxKind.TrueKeyword: {
                program.pushOp(ReflectionOp.literal, program.pushStack(this.f.createTrue()));
                break;
            }
            case SyntaxKind.FalseKeyword: {
                program.pushOp(ReflectionOp.literal, program.pushStack(this.f.createFalse()));
                break;
            }
            case SyntaxKind.ClassDeclaration:
            case SyntaxKind.ClassExpression: {
                //TypeScript does not narrow types down
                const narrowed = node as ClassDeclaration | ClassExpression;

                if (node) {
                    const members: ClassElement[] = [];
                    const empty = program.isEmpty();
                    if (!empty) program.pushFrame();

                    if (narrowed.typeParameters) {
                        for (const typeParameter of narrowed.typeParameters) {
                            const name = getNameAsString(typeParameter.name);
                            program.pushTemplateParameter(name);
                        }
                    }

                    for (const member of narrowed.members) {
                        const name = getNameAsString(member.name);
                        if (name) {
                            const has = members.some(v => getNameAsString(v.name) === name);
                            if (has) continue;
                        }
                        members.push(member);

                        this.extractPackStructOfType(member, program);
                    }

                    program.pushOp(ReflectionOp.class);
                    if (!empty) program.popFrame();
                }
                break;
            }
            case SyntaxKind.IntersectionType: {
                //TypeScript does not narrow types down
                const narrowed = node as IntersectionTypeNode;

                const empty = program.isEmpty();
                if (!empty) program.pushFrame();

                for (const type of narrowed.types) {
                    this.extractPackStructOfType(type, program);
                }

                program.pushOp(ReflectionOp.intersection);
                break;
            }
            case SyntaxKind.MappedType: {
                //TypeScript does not narrow types down
                const narrowed = node as MappedTypeNode;

                //<Type>{[Property in keyof Type]: boolean;};
                program.pushFrame();
                program.pushVariable(narrowed.typeParameter.name.text);

                const constraint = getEffectiveConstraintOfTypeParameter(narrowed.typeParameter);
                if (constraint) {
                    this.extractPackStructOfType(constraint, program);
                } else {
                    program.pushOp(ReflectionOp.never);
                }

                program.pushCoRoutine();
                let modifier = 0;
                if (narrowed.questionToken) {
                    if (narrowed.questionToken.kind === SyntaxKind.QuestionToken) {
                        modifier |= MappedModifier.optional;
                    }
                    if (narrowed.questionToken.kind === SyntaxKind.MinusToken) {
                        modifier |= MappedModifier.removeOptional;
                    }
                }
                if (narrowed.readonlyToken) {
                    if (narrowed.readonlyToken.kind === SyntaxKind.ReadonlyKeyword) {
                        modifier |= MappedModifier.readonly;
                    }
                    if (narrowed.readonlyToken.kind === SyntaxKind.MinusToken) {
                        modifier |= MappedModifier.removeReadonly;
                    }
                }
                if (narrowed.type) {
                    this.extractPackStructOfType(narrowed.type, program);
                } else {
                    program.pushOp(ReflectionOp.never);
                }
                const coRoutineIndex = program.popCoRoutine();

                program.pushOp(ReflectionOp.mappedType, coRoutineIndex, modifier);
                program.popFrame();
                break;
            }
            case SyntaxKind.TypeLiteral:
            case SyntaxKind.InterfaceDeclaration: {
                //TypeScript does not narrow types down
                const narrowed = node as TypeLiteralNode | InterfaceDeclaration;

                //interface X {name: string, [indexName: string]: string}
                //{name: string, [indexName: string]: string};
                //for the moment we just serialize the whole structure directly. It's not very efficient if the same interface is used multiple times.
                //In the future we could create a unique variable with that serialized type and reference to it, so its more efficient.

                //extract all members + from all parents
                const members: TypeElement[] = [];

                const extractMembers = (declaration: InterfaceDeclaration | TypeLiteralNode) => {
                    for (const member of declaration.members) {
                        const name = getNameAsString(member.name);
                        if (name) {
                            const has = members.some(v => getNameAsString(v.name) === name);
                            if (has) continue;
                        }
                        members.push(member);
                        this.extractPackStructOfType(member, program);
                    }

                    if (isInterfaceDeclaration(declaration) && declaration.heritageClauses) {
                        for (const heritage of declaration.heritageClauses) {
                            if (heritage.token === SyntaxKind.ExtendsKeyword) {
                                for (const extendType of heritage.types) {
                                    if (isIdentifier(extendType.expression)) {
                                        const resolved = this.resolveDeclaration(extendType.expression);
                                        if (!resolved) continue;
                                        if (isInterfaceDeclaration(resolved.declaration)) {
                                            extractMembers(resolved.declaration);
                                        }
                                    }
                                }
                            }
                        }
                    }
                };

                program.pushFrame();
                extractMembers(narrowed);
                program.pushOp(ReflectionOp.objectLiteral);
                program.popFrame();
                break;
            }
            case SyntaxKind.TypeReference: {
                this.extractPackStructOfTypeReference(node as TypeReferenceNode, program);
                break;
            }
            case SyntaxKind.ArrayType: {
                this.extractPackStructOfType((node as ArrayTypeNode).elementType, program);
                program.pushOp(ReflectionOp.array);
                break;
            }
            case SyntaxKind.RestType: {
                let type = (node as RestTypeNode).type;
                if (isArrayTypeNode(type)) {
                    type = type.elementType;
                }
                this.extractPackStructOfType(type, program);
                program.pushOp(ReflectionOp.rest);
                break;
            }
            case SyntaxKind.TupleType: {
                program.pushFrame();
                for (const element of (node as TupleTypeNode).elements) {
                    if (isOptionalTypeNode(element)) {
                        this.extractPackStructOfType(element.type, program);
                        program.pushOp(ReflectionOp.tupleMember);
                        program.pushOp(ReflectionOp.optional);
                    } else if (isNamedTupleMember(element)) {
                        if (element.dotDotDotToken) {
                            let type = element.type;
                            if (isArrayTypeNode(type)) {
                                type = type.elementType;
                            }
                            this.extractPackStructOfType(type, program);
                            program.pushOp(ReflectionOp.rest);
                        } else {
                            this.extractPackStructOfType(element.type, program);
                        }
                        const index = program.findOrAddStackEntry(element.name.text);
                        program.pushOp(ReflectionOp.namedTupleMember, index);
                        if (element.questionToken) {
                            program.pushOp(ReflectionOp.optional);
                        }
                    } else {
                        this.extractPackStructOfType(element, program);
                    }
                }
                program.pushOp(ReflectionOp.tuple);
                program.popFrame();
                break;
            }
            case SyntaxKind.PropertySignature: {
                //TypeScript does not narrow types down
                const narrowed = node as PropertySignature;
                if (narrowed.type) {
                    this.extractPackStructOfType(narrowed.type, program);
                    const name = getPropertyName(this.f, narrowed.name);
                    program.pushOp(ReflectionOp.propertySignature, program.findOrAddStackEntry(name));
                    if (narrowed.questionToken) program.pushOp(ReflectionOp.optional);
                    if (hasModifier(narrowed, SyntaxKind.ReadonlyKeyword)) program.pushOp(ReflectionOp.readonly);

                    const description = extractJSDocAttribute(narrowed, 'description');
                    if (description) program.pushOp(ReflectionOp.description, program.findOrAddStackEntry(description));
                }
                break;
            }
            case SyntaxKind.PropertyDeclaration: {
                //TypeScript does not narrow types down
                const narrowed = node as PropertyDeclaration;

                if (narrowed.type) {
                    const config = this.findReflectionConfig(narrowed);
                    if (config.mode === 'never') return;

                    this.extractPackStructOfType(narrowed.type, program);
                    const name = getPropertyName(this.f, narrowed.name);
                    program.pushOp(ReflectionOp.property, program.findOrAddStackEntry(name));

                    if (narrowed.questionToken) program.pushOp(ReflectionOp.optional);
                    if (hasModifier(narrowed, SyntaxKind.ReadonlyKeyword)) program.pushOp(ReflectionOp.readonly);
                    if (hasModifier(narrowed, SyntaxKind.PrivateKeyword)) program.pushOp(ReflectionOp.private);
                    if (hasModifier(narrowed, SyntaxKind.ProtectedKeyword)) program.pushOp(ReflectionOp.protected);
                    if (hasModifier(narrowed, SyntaxKind.AbstractKeyword)) program.pushOp(ReflectionOp.abstract);

                    if (narrowed.initializer) {
                        program.pushOp(ReflectionOp.defaultValue, program.findOrAddStackEntry(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, narrowed.initializer)));
                    }

                    const description = extractJSDocAttribute(narrowed, 'description');
                    if (description) program.pushOp(ReflectionOp.description, program.findOrAddStackEntry(description));
                }
                break;
            }
            case SyntaxKind.ConditionalType: {
                //TypeScript does not narrow types down
                const narrowed = node as ConditionalTypeNode;

                program.pushConditionalFrame();

                this.extractPackStructOfType(narrowed.checkType, program);
                this.extractPackStructOfType(narrowed.extendsType, program);

                program.pushOp(ReflectionOp.extends);

                this.extractPackStructOfType(narrowed.trueType, program);
                this.extractPackStructOfType(narrowed.falseType, program);
                program.pushOp(ReflectionOp.condition);
                program.popFrame();
                break;
            }
            case SyntaxKind.InferType: {
                //TypeScript does not narrow types down
                const narrowed = node as InferTypeNode;

                const frame = program.findConditionalFrame();
                if (frame) {
                    let variable = program.findVariable(narrowed.typeParameter.name.text);
                    if (!variable) {
                        program.pushVariable(narrowed.typeParameter.name.text, frame);
                        variable = program.findVariable(narrowed.typeParameter.name.text);
                        if (!variable) throw new Error('Could not find inserted infer variable');
                    }
                    program.pushOp(ReflectionOp.infer, variable.frameOffset, variable.stackIndex);
                } else {
                    program.pushOp(ReflectionOp.never);
                }
                break;
            }
            case SyntaxKind.MethodDeclaration:
            case SyntaxKind.Constructor:
            case SyntaxKind.ArrowFunction:
            case SyntaxKind.FunctionExpression:
            case SyntaxKind.FunctionType:
            case SyntaxKind.FunctionDeclaration: {
                //TypeScript does not narrow types down
                const narrowed = node as MethodDeclaration | ConstructorDeclaration | ArrowFunction | FunctionExpression | FunctionTypeNode | FunctionDeclaration;

                const config = this.findReflectionConfig(narrowed);
                if (config.mode === 'never') return;

                if (!program.isEmpty()) program.pushFrame();

                const name = isConstructorDeclaration(narrowed) ? 'constructor' : getPropertyName(this.f, narrowed.name);
                if (!narrowed.type && narrowed.parameters.length === 0 && !name) return;

                for (const parameter of narrowed.parameters) {
                    //we support at the moment only identifier as name
                    if (!isIdentifier(parameter.name)) continue;

                    if (parameter.type) {
                        this.extractPackStructOfType(parameter.type, program);
                    } else {
                        program.pushOp(ReflectionOp.any);
                    }

                    program.pushOp(ReflectionOp.parameter, program.findOrAddStackEntry(getNameAsString(parameter.name)));

                    if (parameter.questionToken) program.pushOp(ReflectionOp.optional);
                    if (hasModifier(parameter, SyntaxKind.PublicKeyword)) program.pushOp(ReflectionOp.public);
                    if (hasModifier(parameter, SyntaxKind.PrivateKeyword)) program.pushOp(ReflectionOp.private);
                    if (hasModifier(parameter, SyntaxKind.ProtectedKeyword)) program.pushOp(ReflectionOp.protected);
                    if (hasModifier(narrowed, SyntaxKind.ReadonlyKeyword)) program.pushOp(ReflectionOp.readonly);
                }

                if (narrowed.type) {
                    this.extractPackStructOfType(narrowed.type, program);
                } else {
                    program.pushOp(ReflectionOp.any);
                }

                program.pushOp(isMethodDeclaration(narrowed) || isConstructorDeclaration(narrowed) ? ReflectionOp.method : ReflectionOp.function, program.findOrAddStackEntry(name));

                if (isMethodDeclaration(narrowed)) {
                    if (hasModifier(narrowed, SyntaxKind.PrivateKeyword)) program.pushOp(ReflectionOp.private);
                    if (hasModifier(narrowed, SyntaxKind.ProtectedKeyword)) program.pushOp(ReflectionOp.protected);
                    if (hasModifier(narrowed, SyntaxKind.AbstractKeyword)) program.pushOp(ReflectionOp.abstract);
                }
                break;
            }
            case SyntaxKind.LiteralType: {
                //TypeScript does not narrow types down
                const narrowed = node as LiteralTypeNode;

                if (narrowed.literal.kind === SyntaxKind.NullKeyword) {
                    program.pushOp(ReflectionOp.null);
                } else {
                    program.pushOp(ReflectionOp.literal, program.findOrAddStackEntry(narrowed.literal));
                }
                break;
            }
            case SyntaxKind.UnionType: {
                //TypeScript does not narrow types down
                const narrowed = node as UnionTypeNode;

                if (narrowed.types.length === 0) {
                    //nothing to emit
                } else if (narrowed.types.length === 1) {
                    //only emit the type
                    this.extractPackStructOfType(narrowed.types[0], program);
                } else {
                    const empty = program.isEmpty();
                    if (!empty) program.pushFrame();

                    for (const subType of narrowed.types) {
                        this.extractPackStructOfType(subType, program);
                    }

                    program.pushOp(ReflectionOp.union);
                    if (!empty) program.popFrame();
                }
                break;
            }
            case SyntaxKind.EnumDeclaration: {
                //TypeScript does not narrow types down
                const narrowed = node as EnumDeclaration;
                program.pushFrame();

                for (const type of narrowed.members) {
                    const name = getPropertyName(this.f, type.name);
                    program.pushOp(ReflectionOp.enumMember, program.findOrAddStackEntry(name));
                    if (type.initializer) {
                        program.pushOp(ReflectionOp.defaultValue, program.findOrAddStackEntry(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, type.initializer)));
                    }
                }
                program.pushOp(ReflectionOp.enum);
                program.popFrame();
                break;
            }
            case SyntaxKind.IndexSignature: {
                //TypeScript does not narrow types down
                const narrowed = node as IndexSignatureDeclaration;

                //node.parameters = first item is {[name: string]: number} => 'name: string'
                if (narrowed.parameters[0].type) {
                    this.extractPackStructOfType(narrowed.parameters[0].type, program);
                } else {
                    program.pushOp(ReflectionOp.any);
                }

                //node.type = first item is {[name: string]: number} => 'number'
                this.extractPackStructOfType(narrowed.type, program);
                program.pushOp(ReflectionOp.indexSignature);
                break;
            }
            case SyntaxKind.TypeOperator: {
                //TypeScript does not narrow types down
                const narrowed = node as TypeOperatorNode;

                if (narrowed.operator === SyntaxKind.KeyOfKeyword) {
                    this.extractPackStructOfType(narrowed.type, program);
                    program.pushOp(ReflectionOp.keyof);
                }
                break;
            }
            case SyntaxKind.IndexedAccessType: {
                //TypeScript does not narrow types down
                const narrowed = node as IndexedAccessTypeNode;

                this.extractPackStructOfType(narrowed.objectType, program);
                this.extractPackStructOfType(narrowed.indexType, program);
                program.pushOp(ReflectionOp.query);
                break;
            }
            default: {
                program.pushOp(ReflectionOp.any);
            }
        }
    }

    protected knownClasses: { [name: string]: ReflectionOp } = {
        'Int8Array': ReflectionOp.int8Array,
        'Uint8Array': ReflectionOp.uint8Array,
        'Uint8ClampedArray': ReflectionOp.uint8ClampedArray,
        'Int16Array': ReflectionOp.int16Array,
        'Uint16Array': ReflectionOp.uint16Array,
        'Int32Array': ReflectionOp.int32Array,
        'Uint32Array': ReflectionOp.uint32Array,
        'Float32Array': ReflectionOp.float32Array,
        'Float64Array': ReflectionOp.float64Array,
        'ArrayBuffer': ReflectionOp.arrayBuffer,
        'BigInt64Array': ReflectionOp.bigInt64Array,
        'Date': ReflectionOp.date,
        'String': ReflectionOp.string,
        'Number': ReflectionOp.number,
        'BigInt': ReflectionOp.bigint,
        'Boolean': ReflectionOp.boolean,
    };

    protected resolveDeclaration(e: Node): { declaration: Declaration, importSpecifier?: ImportSpecifier } | undefined {
        // if (!isIdentifier(e)) return;

        const typeChecker = this.getTypeCheckerForSource();
        //this resolves the symbol the typeName from the current file. Either the type declaration itself or the import
        const symbol = typeChecker.getSymbolAtLocation(e);

        let declaration: Declaration | undefined = symbol && symbol.declarations ? symbol.declarations[0] : undefined;

        //if the symbol points to a ImportSpecifier, it means its declared in another file, and we have to use getDeclaredTypeOfSymbol to resolve it.
        const importSpecifier = declaration && isImportSpecifier(declaration) ? declaration : undefined;
        if (symbol && (!declaration || isImportSpecifier(declaration))) {
            const resolvedType = typeChecker.getDeclaredTypeOfSymbol(symbol);
            if (resolvedType && resolvedType.symbol && resolvedType.symbol.declarations && resolvedType.symbol.declarations[0]) {
                declaration = resolvedType.symbol.declarations[0];
            } else if (declaration && isImportSpecifier(declaration)) {
                declaration = this.resolveImportSpecifier(symbol.name, declaration.parent.parent.parent);
            }
        }

        if (!declaration) return;

        return { declaration, importSpecifier };
    }

    // protected resolveType(node: TypeNode): Declaration | Node {
    //     // if (isTypeReferenceNode(node)) {
    //     //     const resolved = this.resolveDeclaration(node.typeName);
    //     //     if (resolved) return resolved.declaration;
    //     //     // } else if (isIndexedAccessTypeNode(node)) {
    //     //     //     const resolved = this.resolveDeclaration(node);
    //     //     //     if (resolved) return resolved.declaration;
    //     // }
    //
    //     const typeChecker = this.getTypeCheckerForSource();
    //     const type = typeChecker.getTypeFromTypeNode(node);
    //     if (type.symbol) {
    //         const declaration: Declaration | undefined = type.symbol && type.symbol.declarations ? type.symbol.declarations[0] : undefined;
    //         if (declaration) return declaration;
    //     } else {
    //         return tsTypeToNode(this.f, type);
    //     }
    //     return node;
    // }

    /**
     * Types added to this map will get a type program directly under it.
     * This is for types used in the very same file.
     */
    protected compileDeclarations = new Map<TypeAliasDeclaration | InterfaceDeclaration | EnumDeclaration, { name: EntityName }>();
    protected compiledDeclarations = new Set<Node>();

    /**
     * Types added to this map will get a type program at the top root level of the program.
     * This is for imported types, which need to be inline into the current file, as we do not emit type imports (TS will omit them).
     */
    protected embedDeclarations = new Map<Node, { name: EntityName }>();

    protected getDeclarationVariableName(typeName: EntityName) {
        if (isIdentifier(typeName)) {
            return this.f.createIdentifier('__Ω' + typeName.text);
        }

        function joinQualifiedName(name: EntityName): string {
            if (isIdentifier(name)) return name.text;
            return joinQualifiedName(name.left) + '_' + name.right.text;
        }

        return this.f.createIdentifier('__Ω' + joinQualifiedName(typeName));
    }

    protected extractPackStructOfTypeReference(type: TypeReferenceNode, program: CompilerProgram) {
        if (isIdentifier(type.typeName) && this.knownClasses[type.typeName.text]) {
            program.pushOp(this.knownClasses[type.typeName.text]);
        } else if (isIdentifier(type.typeName) && type.typeName.text === 'Promise') {
            //promise has always one sub type
            if (type.typeArguments && type.typeArguments[0]) {
                this.extractPackStructOfType(type.typeArguments[0], program);
            } else {
                program.pushOp(ReflectionOp.any);
            }
            program.pushOp(ReflectionOp.promise);
        } else if (isIdentifier(type.typeName) && type.typeName.text === 'integer') {
            program.pushOp(ReflectionOp.numberBrand, TypeNumberBrand.integer as number);
        } else if (isIdentifier(type.typeName) && TypeNumberBrand[type.typeName.text as any] !== undefined) {
            program.pushOp(ReflectionOp.numberBrand, TypeNumberBrand[type.typeName.text as any] as any);
        } else {
            //check if it references a variable
            if (isIdentifier(type.typeName)) {
                const variable = program.findVariable(type.typeName.text);
                if (variable) {
                    program.pushOp(ReflectionOp.loads, variable.frameOffset, variable.stackIndex);
                    return;
                }
            }

            const resolved = this.resolveDeclaration(type.typeName);
            if (!resolved) {
                //if a global well-known type is not available, we try to check its name and infer from it the actual type.
                if (isIdentifier(type.typeName)) {
                    if (type.typeName.escapedText === 'Omit') {
                    }
                    if (type.typeName.escapedText === 'Exclude') {
                    }
                    if (type.typeName.escapedText === 'Record') {
                        if (type.typeArguments && type.typeArguments.length === 2) {
                            for (const argument of type.typeArguments) {
                                this.extractPackStructOfType(argument, program);
                            }
                            program.pushOp(ReflectionOp.indexSignature);
                            program.pushOp(ReflectionOp.objectLiteral);
                            return;
                        }
                    }
                    if (type.typeName.escapedText === 'Partial') {
                        console.log(type);
                    }
                }

                //non existing references are ignored.
                program.pushOp(ReflectionOp.any);
                return;
            }

            /**
             * For imports that can removed (like a class import only used as type only, like `p: Model[]`) we have
             * to modify the import so TS does not remove it.
             */
            function ensureImportIsEmitted() {
                if (resolved!.importSpecifier) {
                    //make synthetic. Let the TS compiler keep this import
                    (resolved!.importSpecifier as any).flags |= NodeFlags.Synthesized;
                }
            }

            const declaration = resolved.declaration;

            if (isTypeAliasDeclaration(declaration) || isInterfaceDeclaration(declaration) || isEnumDeclaration(declaration)) {
                //Set/Map are interface declarations
                const name = getNameAsString(type.typeName);
                if (name === 'Set') {
                    if (type.typeArguments && type.typeArguments[0]) {
                        this.extractPackStructOfType(type.typeArguments[0], program);
                    } else {
                        program.pushOp(ReflectionOp.any);
                    }
                    program.pushOp(ReflectionOp.set);
                    return;
                } else if (name === 'Map') {
                    if (type.typeArguments && type.typeArguments[0]) {
                        this.extractPackStructOfType(type.typeArguments[0], program);
                    } else {
                        program.pushOp(ReflectionOp.any);
                    }
                    if (type.typeArguments && type.typeArguments[1]) {
                        this.extractPackStructOfType(type.typeArguments[1], program);
                    } else {
                        program.pushOp(ReflectionOp.any);
                    }
                    program.pushOp(ReflectionOp.map);
                    return;
                }

                // store its declaration in its own definition program
                const index = program.pushStack(program.forNode === declaration ? 0 : this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, this.getDeclarationVariableName(type.typeName)));

                //to break recursion, we track which declaration has already been compiled
                if (!this.compiledDeclarations.has(declaration)) {
                    if (resolved!.importSpecifier) {
                        this.embedDeclarations.set(declaration, { name: type.typeName });
                    } else {
                        this.compileDeclarations.set(declaration, { name: type.typeName });
                    }
                }

                if (type.typeArguments) {
                    for (const argument of type.typeArguments) {
                        this.extractPackStructOfType(argument, program);
                    }
                    program.pushOp(ReflectionOp.inlineCall, index, type.typeArguments.length);
                } else {
                    program.pushOp(ReflectionOp.inline, index);
                }
            } else if (isTypeLiteralNode(declaration)) {
                this.extractPackStructOfType(declaration, program);
                return;
            } else if (isMappedTypeNode(declaration)) {
                //<Type>{[Property in keyof Type]: boolean;};
                this.extractPackStructOfType(declaration, program);
                return;
            } else if (isClassDeclaration(declaration)) {
                ensureImportIsEmitted();
                program.pushFrame();

                if (type.typeArguments) {
                    for (const template of type.typeArguments) {
                        this.extractPackStructOfType(template, program);
                    }
                }

                const index = program.pushStack(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName)));
                program.pushOp(ReflectionOp.classReference);
                program.pushOp(index);
                program.popFrame();
            } else {
                this.extractPackStructOfType(declaration, program);
            }
        }
    }

    protected createAccessorForEntityName(e: QualifiedName): PropertyAccessExpression {
        return this.f.createPropertyAccessExpression(isIdentifier(e.left) ? e.left : this.createAccessorForEntityName(e.left), e.right);
    }

    protected findDeclarationInFile(sourceFile: SourceFile, declarationName: string): Declaration | undefined {
        if (isNodeWithLocals(sourceFile) && sourceFile.locals) {
            const declarationSymbol = sourceFile.locals.get(declarationName as __String);
            if (declarationSymbol && declarationSymbol.declarations && declarationSymbol.declarations[0]) {
                return declarationSymbol.declarations[0];
            }
        }
        return;
    }

    protected resolveImportSpecifier(declarationName: string, importOrExport: ExportDeclaration | ImportDeclaration): Declaration | undefined {
        if (!importOrExport.moduleSpecifier) return;
        if (!isStringLiteral(importOrExport.moduleSpecifier)) return;

        const source = this.resolver.getExternalModuleFileFromDeclaration(importOrExport);
        if (!source) return;

        const declaration = this.findDeclarationInFile(source, declarationName);
        if (declaration) return declaration;

        //not found, look in exports
        for (const statement of source.statements) {
            if (!isExportDeclaration(statement)) continue;

            if (statement.exportClause) {
                //export {y} from 'x'
                if (isNamedExports(statement.exportClause)) {
                    for (const element of statement.exportClause.elements) {
                        //see if declarationName is exported
                        if (element.name.text === declarationName) {
                            const found = this.resolveImportSpecifier(element.propertyName ? element.propertyName.text : declarationName, statement);
                            if (found) return found;
                        }
                    }
                }
            } else {
                //export * from 'x'
                //see if `x` exports declarationName (or one of its exports * from 'y')
                const found = this.resolveImportSpecifier(declarationName, statement);
                if (found) {
                    return found;
                }
            }
        }

        return;
    }

    protected getTypeOfType(type: Node | Declaration): Expression | undefined {
        const reflection = this.findReflectionConfig(type);
        if (reflection.mode === 'never') return;

        const program = new CompilerProgram(type);
        this.extractPackStructOfType(type, program);
        return this.packOpsAndStack(program.buildPackStruct());
    }

    protected packOpsAndStack(packStruct: PackStruct) {
        if (packStruct.ops.length === 0) return;
        const packed = pack(packStruct);
        debugPackStruct(packStruct);
        return this.valueToExpression(packed);
    }

    /**
     *
     * Note: We have to duplicate the expressions as it can be that incoming expression are from another file and contain wrong pos/end properties,
     * so the code generation is then broken when we simply reuse them. Wrong code like ``User.__type = [.toEqual({`` is then generated.
     * This function is probably not complete, but we add new copies when required.
     */
    protected valueToExpression(value: PackExpression | PackExpression[]): Expression {
        if (isArray(value)) return this.f.createArrayLiteralExpression(this.f.createNodeArray(value.map(v => this.valueToExpression(v))));
        if ('string' === typeof value) return this.f.createStringLiteral(value, true);
        if ('number' === typeof value) return this.f.createNumericLiteral(value);
        if ('bigint' === typeof value) return this.f.createBigIntLiteral(String(value));
        if ('boolean' === typeof value) return value ? this.f.createTrue() : this.f.createFalse();

        if (value.kind === SyntaxKind.StringLiteral) return this.f.createStringLiteral((value as StringLiteral).text, true);
        if (value.kind === SyntaxKind.NumericLiteral) return this.f.createNumericLiteral((value as NumericLiteral).text);
        if (value.kind === SyntaxKind.BigIntLiteral) return this.f.createBigIntLiteral((value as BigIntLiteral).text);
        if (value.kind === SyntaxKind.TrueKeyword) return this.f.createTrue();
        if (value.kind === SyntaxKind.FalseKeyword) return this.f.createFalse();

        return value;
    }

    /**
     * A class is decorated with type information by adding a static variable.
     *
     * class Model {
     *     static __types = pack(ReflectionOp.string); //<-- encoded type information
     *     title: string;
     * }
     */
    protected decorateClass(node: ClassDeclaration | ClassExpression): Node {
        const reflection = this.findReflectionConfig(node);
        if (reflection.mode === 'never') return node;
        const type = this.getTypeOfType(node);
        const __type = this.f.createPropertyDeclaration(undefined, this.f.createModifiersFromModifierFlags(ModifierFlags.Static), '__type', undefined, undefined, type);
        if (isClassDeclaration(node)) {
            // return node;
            return this.f.updateClassDeclaration(node, node.decorators, node.modifiers,
                node.name, node.typeParameters, node.heritageClauses,
                this.f.createNodeArray<ClassElement>([...node.members, __type])
            );
        }

        return this.f.updateClassExpression(node, node.decorators, node.modifiers,
            node.name, node.typeParameters, node.heritageClauses,
            this.f.createNodeArray<ClassElement>([...node.members, __type])
        );
    }

    /**
     * const fn = function() {}
     *
     * => const fn = Object.assign(function() {}, {__type: 34})
     */
    protected decorateFunctionExpression(expression: FunctionExpression) {
        const encodedType = this.getTypeOfType(expression);
        if (!encodedType) return expression;

        const __type = this.f.createObjectLiteralExpression([
            this.f.createPropertyAssignment('__type', encodedType)
        ]);

        return this.f.createCallExpression(this.f.createPropertyAccessExpression(this.f.createIdentifier('Object'), 'assign'), undefined, [
            expression, __type
        ]);
    }

    /**
     * function name() {}
     *
     * => function name() {}; name.__type = 34;
     */
    protected decorateFunctionDeclaration(declaration: FunctionDeclaration) {
        const encodedType = this.getTypeOfType(declaration);
        if (!encodedType) return declaration;

        const statements: Statement[] = [declaration];

        statements.push(this.f.createExpressionStatement(
            this.f.createAssignment(this.f.createPropertyAccessExpression(declaration.name!, '__type'), encodedType)
        ));
        return statements;
    }

    /**
     * const fn = () => { }
     * => const fn = Object.assign(() => {}, {__type: 34})
     */
    protected decorateArrow(expression: ArrowFunction) {
        const encodedType = this.getTypeOfType(expression);
        if (!encodedType) return expression;

        const __type = this.f.createObjectLiteralExpression([
            this.f.createPropertyAssignment('__type', encodedType)
        ]);

        return this.f.createCallExpression(this.f.createPropertyAccessExpression(this.f.createIdentifier('Object'), 'assign'), undefined, [
            expression, __type
        ]);
    }

    protected parseReflectionMode(mode?: typeof reflectionModes[number] | '' | boolean): typeof reflectionModes[number] {
        if ('boolean' === typeof mode) return mode ? 'default' : 'never';
        return mode || 'never';
    }

    protected resolvedTsConfig: { [path: string]: { data: Record<string, any>, exists: boolean } } = {};

    protected findReflectionConfig(node: Node): { mode: typeof reflectionModes[number] } {
        let current: Node | undefined = node;
        let reflection: typeof reflectionModes[number] | undefined;

        do {
            const tags = getJSDocTags(current);
            for (const tag of tags) {
                if (!reflection && tag.tagName.text === 'reflection' && 'string' === typeof tag.comment) {
                    return { mode: this.parseReflectionMode(tag.comment as any || true) };
                }
            }
            current = current.parent;
        } while (current);

        //nothing found, look in tsconfig.json
        if (this.reflectionMode !== undefined) return { mode: this.reflectionMode };
        let currentDir = dirname(this.sourceFile.fileName);

        while (currentDir) {
            const tsconfigPath = join(currentDir, 'tsconfig.json');
            let tsConfig: Record<string, any> = {};
            const cache = this.resolvedTsConfig[tsconfigPath];
            if (cache) {
                tsConfig = this.resolvedTsConfig[tsconfigPath].data;
            } else {
                const exists = existsSync(tsconfigPath);
                this.resolvedTsConfig[tsconfigPath] = { exists, data: {} };
                if (exists) {
                    try {
                        let content = readFileSync(tsconfigPath, 'utf8');
                        content = stripJsonComments(content);
                        tsConfig = JSON.parse(content);
                        this.resolvedTsConfig[tsconfigPath].data = tsConfig;
                    } catch (error: any) {
                        console.warn(`Could not parse ${tsconfigPath}: ${error}`);
                    }
                }
            }
            if (reflection === undefined && tsConfig.reflection !== undefined) {
                return { mode: this.parseReflectionMode(tsConfig.reflection) };
            }
            const next = join(currentDir, '..');
            if (resolve(next) === resolve(currentDir)) break; //we are at root
            currentDir = next;
        }

        return { mode: reflection || 'never' };
    }
}

let loaded = false;
export const transformer: CustomTransformerFactory = (context) => {
    if (!loaded) {
        process.stderr.write('@deepkit/type transformer loaded\n');
        loaded = true;
    }
    return new ReflectionTransformer(context);
};
