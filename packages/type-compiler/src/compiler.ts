/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import * as ts from 'typescript';
import {
    __String,
    ArrayTypeNode,
    ArrowFunction,
    Bundle,
    ClassDeclaration,
    ClassElement,
    ClassExpression,
    CompilerHost,
    ConditionalTypeNode,
    ConstructorDeclaration,
    ConstructorTypeNode,
    ConstructSignatureDeclaration,
    createCompilerHost,
    createPrinter,
    CustomTransformer,
    CustomTransformerFactory,
    Declaration,
    EmitHint,
    EntityName,
    EnumDeclaration,
    escapeLeadingUnderscores,
    ExportDeclaration,
    Expression,
    ExpressionWithTypeArguments,
    FunctionDeclaration,
    FunctionExpression,
    FunctionTypeNode,
    getEffectiveConstraintOfTypeParameter,
    getJSDocTags,
    Identifier,
    ImportDeclaration,
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
    isConstructorTypeNode,
    isConstructSignatureDeclaration,
    isEnumDeclaration,
    isExportDeclaration,
    isExpressionWithTypeArguments,
    isFunctionDeclaration,
    isFunctionExpression,
    isFunctionLike,
    isIdentifier,
    isImportClause,
    isImportDeclaration,
    isImportSpecifier,
    isInferTypeNode,
    isInterfaceDeclaration,
    isMethodDeclaration,
    isMethodSignature,
    isModuleDeclaration,
    isNamedExports,
    isNamedTupleMember,
    isNewExpression,
    isObjectLiteralExpression,
    isOptionalTypeNode,
    isParameter,
    isParenthesizedExpression,
    isParenthesizedTypeNode,
    isPropertyAccessExpression,
    isQualifiedName,
    isSourceFile,
    isStringLiteral,
    isTypeAliasDeclaration,
    isTypeParameterDeclaration,
    isTypeQueryNode,
    isTypeReferenceNode,
    isUnionTypeNode,
    LiteralTypeNode,
    MappedTypeNode,
    MethodDeclaration,
    MethodSignature,
    ModifierFlags,
    ModuleDeclaration,
    ModuleKind,
    Node,
    NodeFactory,
    NodeFlags,
    PropertyAccessExpression,
    PropertyDeclaration,
    PropertySignature,
    QualifiedName,
    RestTypeNode,
    SignatureDeclaration,
    Statement,
    SyntaxKind,
    TemplateLiteralTypeNode,
    TransformationContext,
    TupleTypeNode,
    TypeAliasDeclaration,
    TypeChecker,
    TypeLiteralNode,
    TypeNode,
    TypeOperatorNode,
    TypeParameterDeclaration,
    TypeQueryNode,
    TypeReferenceNode,
    UnionTypeNode,
    visitEachChild,
    visitNode
} from 'typescript';
import {
    ensureImportIsEmitted,
    extractJSDocAttribute,
    getGlobalsOfSourceFile,
    getIdentifierName,
    getNameAsString,
    getPropertyName,
    hasModifier,
    isNodeWithLocals,
    NodeConverter,
    PackExpression,
    serializeEntityNameAsExpression,
} from './reflection-ast.js';
import { SourceFile } from './ts-types.js';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import stripJsonComments from 'strip-json-comments';
import { MappedModifier, ReflectionOp, TypeNumberBrand } from '@deepkit/type-spec';
import { Resolver } from './resolver.js';
import { knownLibFilesForCompilerOptions } from '@typescript/vfs';

export function encodeOps(ops: ReflectionOp[]): string {
    return ops.map(v => String.fromCharCode(v + 33)).join('');
}

function debug(...message: any[]): void {
    if ('undefined' !== typeof process && 'string' === typeof process.env.DEBUG && process.env.DEBUG.includes('deepkit')) {
        console.debug(...message);
    }
}

export const packSizeByte: number = 6;

const serverEnv = 'undefined' !== typeof process;

/**
 * It can't be more ops than this given number
 */
export const packSize: number = 2 ** packSizeByte; //64
const reflectionModes = ['always', 'default', 'never'] as const;

const OPs: { [op in ReflectionOp]?: { params: number } } = {
    [ReflectionOp.literal]: { params: 1 },
    // [ReflectionOp.pointer]: { params: 1 },
    // [ReflectionOp.arg]: { params: 1 },
    [ReflectionOp.classReference]: { params: 1 },
    [ReflectionOp.propertySignature]: { params: 1 },
    [ReflectionOp.property]: { params: 1 },
    [ReflectionOp.jump]: { params: 1 },
    [ReflectionOp.enum]: { params: 0 },
    [ReflectionOp.enumMember]: { params: 1 },
    [ReflectionOp.typeParameter]: { params: 1 },
    [ReflectionOp.typeParameterDefault]: { params: 1 },
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
    [ReflectionOp.typeof]: { params: 1 },
    [ReflectionOp.classExtends]: { params: 1 },
    [ReflectionOp.distribute]: { params: 1 },
    [ReflectionOp.jumpCondition]: { params: 2 },
};

export function debugPackStruct(sourceFile: SourceFile, forType: Node, pack: { ops: ReflectionOp[], stack: PackExpression[] }): void {
    const items: any[] = [];

    for (let i = 0; i < pack.ops.length; i++) {
        const op = pack.ops[i];
        const opInfo = OPs[op];
        items.push(ReflectionOp[op]);
        if (opInfo && opInfo.params > 0) {
            for (let j = 0; j < opInfo.params; j++) {
                const address = pack.ops[++i];
                items.push(address);
            }
        }
    }

    const printer = createPrinter();
    const stack: any[] = [];
    for (const s of pack.stack) {
        if ('object' === typeof s && 'getText' in s) {
            stack.push(printer.printNode(EmitHint.Unspecified, s, sourceFile));
        } else {
            stack.push(s);
        }
    }
    // console.log('debugPackStruct:', 'getText' in forType ? forType.getText().replace(/\n/g, '') : 'no node'); //printer.printNode(EmitHint.Unspecified, forType, sourceFile).replace(/\n/g, ''));
    console.log(stack.join(','), '|', ...items);
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

function findSourceFile(node: Node): SourceFile | undefined {
    if (node.kind === SyntaxKind.SourceFile) return node as SourceFile;
    let current = node.parent;
    while (current && current.kind !== SyntaxKind.SourceFile) {
        current = current.parent;
    }
    return current as SourceFile;
}

type StackEntry = Expression | string | number | boolean;

class CompilerProgram {
    protected ops: ReflectionOp[] = [];
    protected stack: StackEntry[] = [];
    protected mainOffset: number = 0;

    protected stackPosition: number = 0;

    protected frame: Frame = { variables: [], opIndex: 0 };

    protected activeCoRoutines: { ops: ReflectionOp[] }[] = [];
    protected coRoutines: { ops: ReflectionOp[] }[] = [];

    constructor(public forNode: Node, public sourceFile: SourceFile) {
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
        this.popFrameImplicit();
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
        for (const op of ops) {
            if ('number' !== typeof op) {
                throw new Error('No valid OP added');
            }
            // if (op + 33 > 126) {
            //todo: encode as var int
            // throw new Error('stack pointer too big ' + op);
            // }
        }
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

    protected resolveFunctionParameters = new Map<Node, number>();

    resolveFunctionParametersIncrease(fn: Node) {
        this.resolveFunctionParameters.set(fn, (this.resolveFunctionParameters.get(fn) || 0) + 1);
    }

    resolveFunctionParametersDecrease(fn: Node) {
        this.resolveFunctionParameters.set(fn, (this.resolveFunctionParameters.get(fn) || 1) - 1);
    }

    isResolveFunctionParameters(fn: Node) {
        return (this.resolveFunctionParameters.get(fn) || 0) > 0;
    }

    /**
     *
     * Each pushFrame() call needs a popFrame() call.
     */
    pushFrame(implicit: boolean = false) {
        if (!implicit) this.pushOp(ReflectionOp.frame);
        const opIndex = this.activeCoRoutines.length ? this.activeCoRoutines[this.activeCoRoutines.length - 1].ops.length : this.ops.length;
        this.frame = { previous: this.frame, variables: [], opIndex };
        return this.frame;
    }

    findConditionalFrame() {
        return findConditionalFrame(this.frame);
    }

    /**
     * Remove stack without doing it as OP in the processor. Some other command calls popFrame() already, which makes popFrameImplicit() an implicit popFrame.
     * e.g. union, class, etc. all call popFrame(). the current CompilerProgram needs to be aware of that, which this function is for.
     */
    popFrameImplicit() {
        if (this.frame.previous) this.frame = this.frame.previous;
    }

    moveFrame() {
        this.pushOp(ReflectionOp.moveFrame);
        if (this.frame.previous) this.frame = this.frame.previous;
    }

    pushVariable(name: string, frame: Frame = this.frame): number {
        this.pushOpAtFrame(frame, ReflectionOp.var);
        frame.variables.push({
            index: frame.variables.length,
            name,
        });
        return frame.variables.length - 1;
    }

    pushTemplateParameter(name: string, withDefault: boolean = false): number {
        this.pushOp(withDefault ? ReflectionOp.typeParameterDefault : ReflectionOp.typeParameter, this.findOrAddStackEntry(name));
        this.frame.variables.push({
            index: this.frame.variables.length,
            name,
        });
        return this.frame.variables.length - 1;
    }

    findVariable(name: string, frame = this.frame) {
        return findVariable(frame, name);
    }
}

function getAssignTypeExpression(call: Expression): Expression | undefined {
    if (isParenthesizedExpression(call) && isCallExpression(call.expression)) {
        call = call.expression;
    }

    if (isCallExpression(call) && isIdentifier(call.expression) && getIdentifierName(call.expression) === '__assignType' && call.arguments.length > 0) {
        return call.arguments[0];
    }

    return;
}

function getReceiveTypeParameter(type: TypeNode): TypeReferenceNode | undefined {
    if (isUnionTypeNode(type)) {
        for (const t of type.types) {
            const rfn = getReceiveTypeParameter(t);
            if (rfn) return rfn;
        }
    } else if (isTypeReferenceNode(type) && isIdentifier(type.typeName)
        && getIdentifierName(type.typeName) === 'ReceiveType' && !!type.typeArguments
        && type.typeArguments.length === 1) return type;

    return;
}

/**
 * Read the TypeScript AST and generate pack struct (instructions + pre-defined stack).
 *
 * This transformer extracts type and add the encoded (so its small and low overhead) at classes and functions as property.
 *
 * Deepkit/type can then extract and decode them on-demand.
 */
export class ReflectionTransformer implements CustomTransformer {
    sourceFile!: SourceFile;
    protected f: NodeFactory;

    protected embedAssignType: boolean = false;

    protected reflectionMode?: typeof reflectionModes[number];

    /**
     * Types added to this map will get a type program directly under it.
     * This is for types used in the very same file.
     */
    protected compileDeclarations = new Map<TypeAliasDeclaration | InterfaceDeclaration | EnumDeclaration, { name: EntityName, sourceFile: SourceFile, compiled?: Statement[] }>();

    /**
     * Types added to this map will get a type program at the top root level of the program.
     * This is for imported types, which need to be inlined into the current file, as we do not emit type imports (TS will omit them).
     */
    protected embedDeclarations = new Map<Node, { name: EntityName, sourceFile: SourceFile }>();

    /**
     * When a node was embedded or compiled (from the maps above), we store it here to know to not add it again.
     */
    protected compiledDeclarations = new Set<Node>();

    protected addImports: { from: Expression, identifier: Identifier }[] = [];

    protected nodeConverter: NodeConverter;
    protected typeChecker?: TypeChecker;
    protected resolver: Resolver;
    protected host: CompilerHost;

    /**
     * When an deep call expression was found a script-wide variable is necessary
     * as temporary storage.
     */
    protected tempResultIdentifier?: Identifier;

    constructor(
        protected context: TransformationContext,
    ) {
        this.f = context.factory;
        this.nodeConverter = new NodeConverter(this.f);
        this.host = createCompilerHost(context.getCompilerOptions());
        this.resolver = new Resolver(context.getCompilerOptions(), this.host);
    }

    forHost(host: CompilerHost): this {
        this.resolver.host = host;
        return this;
    }

    withReflectionMode(mode: typeof reflectionModes[number]): this {
        this.reflectionMode = mode;
        return this;
    }

    transformBundle(node: Bundle): Bundle {
        return node;
    }

    getTempResultIdentifier(): Identifier {
        if (this.tempResultIdentifier) return this.tempResultIdentifier;

        const locals = isNodeWithLocals(this.sourceFile) ? this.sourceFile.locals : undefined;

        if (locals) {
            let found = 'Ωr';
            for (let i = 0; ; i++) {
                found = 'Ωr' + (i ? i : '');
                if (!locals.has(escapeLeadingUnderscores(found))) break;
            }
            this.tempResultIdentifier = this.f.createIdentifier(found);
        } else {
            this.tempResultIdentifier = this.f.createIdentifier('Ωr');
        }
        return this.tempResultIdentifier;
    }

    transformSourceFile(sourceFile: SourceFile): SourceFile {
        if ((sourceFile as any).deepkitTransformed) return sourceFile;
        (sourceFile as any).deepkitTransformed = true;
        this.embedAssignType = false;

        if (!(sourceFile as any).locals) {
            //@ts-ignore
            ts.bindSourceFile(sourceFile, this.context.getCompilerOptions());
        }

        this.addImports = [];
        this.sourceFile = sourceFile;

        const reflection = this.findReflectionConfig(sourceFile);
        if (reflection.mode === 'never') {
            return sourceFile;
        }

        if (sourceFile.kind !== SyntaxKind.SourceFile) {
            const path = require.resolve('typescript');
            throw new Error(`Invalid TypeScript library imported. SyntaxKind different ${sourceFile.kind} !== ${SyntaxKind.SourceFile}. typescript package path: ${path}`);
        }

        const visitor = (node: Node): any => {
            node = visitEachChild(node, visitor, this.context);

            if ((isInterfaceDeclaration(node) || isTypeAliasDeclaration(node) || isEnumDeclaration(node))) {
                const reflection = this.findReflectionConfig(node);

                if (reflection.mode !== 'never') {
                    this.compileDeclarations.set(node, {
                        name: node.name,
                        sourceFile: this.sourceFile
                    });
                }
            }

            if (isMethodDeclaration(node) && node.parent && node.body && isObjectLiteralExpression(node.parent)) {
                //replace MethodDeclaration with MethodExpression
                // {add(v: number) {}} => {add: function (v: number) {}}
                //so that __type can be added.
                //{default(){}} can not be converted without losing the function name, so we skip that for the moment.
                let valid = true;
                if (node.name.kind === SyntaxKind.Identifier && getIdentifierName(node.name) === 'default') valid = false;
                if (valid) {
                    const method = this.decorateFunctionExpression(
                        this.f.createFunctionExpression(
                            node.modifiers, node.asteriskToken, isIdentifier(node.name) ? node.name : undefined,
                            node.typeParameters, node.parameters, node.type, node.body
                        )
                    );
                    node = this.f.createPropertyAssignment(node.name, method);
                }
            }

            if (isClassDeclaration(node)) {
                return this.decorateClass(node);
            } else if (isParameter(node) && node.parent && node.type) {
                // ReceiveType
                const typeParameters = isConstructorDeclaration(node.parent) ? node.parent.parent.typeParameters : node.parent.typeParameters;
                if (!typeParameters) return node;

                const receiveType = getReceiveTypeParameter(node.type);
                if (receiveType && receiveType.typeArguments) {
                    const first = receiveType.typeArguments[0];
                    if (first && isTypeReferenceNode(first) && isIdentifier(first.typeName)) {
                        const name = getIdentifierName(first.typeName);
                        //find type parameter position
                        const index = typeParameters.findIndex(v => getIdentifierName(v.name) === name);

                        let container: Expression = this.f.createIdentifier('globalThis');
                        if ((isFunctionDeclaration(node.parent) || isFunctionExpression(node.parent)) && node.parent.name) {
                            container = node.parent.name;
                        } else if (isMethodDeclaration(node.parent) && isIdentifier(node.parent.name)) {
                            container = this.f.createPropertyAccessExpression(this.f.createIdentifier('this'), node.parent.name);
                        } else if (isConstructorDeclaration(node.parent)) {
                            container = this.f.createPropertyAccessExpression(this.f.createIdentifier('this'), 'constructor');
                        }

                        return this.f.updateParameterDeclaration(node, node.decorators, node.modifiers, node.dotDotDotToken, node.name,
                            node.questionToken, receiveType, this.f.createElementAccessChain(
                                this.f.createPropertyAccessExpression(
                                    container,
                                    this.f.createIdentifier('Ω'),
                                ),
                                this.f.createToken(SyntaxKind.QuestionDotToken),
                                this.f.createNumericLiteral(index)
                            )
                        );
                    }
                }
            } else if (isClassExpression(node)) {
                return this.decorateClass(node);
            } else if (isFunctionExpression(node)) {
                return this.decorateFunctionExpression(this.injectResetΩ(node));
            } else if (isFunctionDeclaration(node)) {
                return this.decorateFunctionDeclaration(this.injectResetΩ(node));
            } else if (isMethodDeclaration(node) || isConstructorDeclaration(node)) {
                return this.injectResetΩ(node);
            } else if (isArrowFunction(node)) {
                return this.decorateArrow(node);
            } else if ((isNewExpression(node) || isCallExpression(node)) && node.typeArguments && node.typeArguments.length > 0) {

                if (isCallExpression(node)) {
                    const autoTypeFunctions = ['valuesOf', 'propertiesOf', 'typeOf'];
                    if (isIdentifier(node.expression) && autoTypeFunctions.includes(getIdentifierName(node.expression))) {
                        const args: Expression[] = [...node.arguments];

                        if (!args.length) {
                            args.push(this.f.createArrayLiteralExpression());
                        }

                        // const resolvedType = this.resolveType(node.typeArguments[0]);
                        const type = this.getTypeOfType(node.typeArguments[0]);
                        if (!type) return node;
                        args.push(type);

                        return this.f.updateCallExpression(node, node.expression, node.typeArguments, this.f.createNodeArray(args));
                    }
                }

                //put the type argument in FN.Ω
                const expressionToCheck = getAssignTypeExpression(node.expression) || node.expression;
                if (isArrowFunction(expressionToCheck)) {
                    //inline arrow functions are excluded from type passing
                    return node;
                }

                const typeExpressions: Expression[] = [];
                for (const a of node.typeArguments) {
                    const type = this.getTypeOfType(a);
                    typeExpressions.push(type || this.f.createIdentifier('undefined'));
                }

                let container: Expression = this.f.createIdentifier('globalThis');
                if (isIdentifier(node.expression)) {
                    container = node.expression;
                } else if (isPropertyAccessExpression(node.expression)) {
                    container = node.expression;
                }

                const assignQ = this.f.createBinaryExpression(
                    this.f.createPropertyAccessExpression(container, 'Ω'),
                    this.f.createToken(SyntaxKind.EqualsToken),
                    this.f.createArrayLiteralExpression(typeExpressions),
                );

                const update: any = isNewExpression(node) ? this.f.updateNewExpression : this.f.updateCallExpression;

                if (isPropertyAccessExpression(node.expression)) {
                    //e.g. http.deep.response();
                    if (isCallExpression(node.expression.expression)) {
                        //e.g. http.deep().response();
                        //change to (Ωr = http.deep(), Ωr.response.Ω = [], Ωr).response()
                        const r = this.getTempResultIdentifier();
                        const assignQ = this.f.createBinaryExpression(
                            this.f.createPropertyAccessExpression(
                                this.f.createPropertyAccessExpression(r, node.expression.name),
                                'Ω'
                            ),
                            this.f.createToken(SyntaxKind.EqualsToken),
                            this.f.createArrayLiteralExpression(typeExpressions),
                        );

                        return update(node,
                            this.f.createPropertyAccessExpression(
                                this.f.createParenthesizedExpression(this.f.createBinaryExpression(
                                    this.f.createBinaryExpression(
                                        this.f.createBinaryExpression(
                                            r,
                                            this.f.createToken(ts.SyntaxKind.EqualsToken),
                                            node.expression.expression
                                        ),
                                        this.f.createToken(ts.SyntaxKind.CommaToken),
                                        assignQ
                                    ),
                                    this.f.createToken(ts.SyntaxKind.CommaToken),
                                    r
                                )),
                                node.expression.name
                            ),
                            node.typeArguments,
                            node.arguments
                        );

                    } else if (isParenthesizedExpression(node.expression.expression)) {
                        //e.g. (http.deep()).response();
                        //only work necessary when `http.deep()` is using type args and was converted to:
                        //  (Ω = [], http.deep()).response()

                        //it's a call like (obj.method.Ω = ['a'], obj.method()).method()
                        //which needs to be converted so that Ω is correctly read by the last call
                        //(r = (obj.method.Ω = [['a']], obj.method()), obj.method.Ω = [['b']], r).method());

                        const r = this.getTempResultIdentifier();
                        const assignQ = this.f.createBinaryExpression(
                            this.f.createPropertyAccessExpression(
                                this.f.createPropertyAccessExpression(r, node.expression.name),
                                'Ω'
                            ),
                            this.f.createToken(SyntaxKind.EqualsToken),
                            this.f.createArrayLiteralExpression(typeExpressions),
                        );

                        const updatedNode = update(
                            node,
                            this.f.updatePropertyAccessExpression(
                                node.expression,
                                this.f.updateParenthesizedExpression(
                                    node.expression.expression,
                                    this.f.createBinaryExpression(
                                        this.f.createBinaryExpression(
                                            this.f.createBinaryExpression(
                                                r,
                                                this.f.createToken(SyntaxKind.EqualsToken),
                                                node.expression.expression.expression,
                                            ),
                                            this.f.createToken(SyntaxKind.CommaToken),
                                            assignQ
                                        ),
                                        this.f.createToken(SyntaxKind.CommaToken),
                                        r,
                                    )
                                ),
                                node.expression.name
                            ),
                            node.typeArguments,
                            node.arguments
                        );

                        return this.f.createParenthesizedExpression(updatedNode);
                    } else {
                        //e.g. http.deep.response();
                        //nothing to do
                    }
                }

                //(fn.Ω = [], call())
                return this.f.createParenthesizedExpression(this.f.createBinaryExpression(
                    assignQ,
                    this.f.createToken(SyntaxKind.CommaToken),
                    node,
                ));
            }

            return node;
        };
        this.sourceFile = visitNode(this.sourceFile, visitor);

        while (true) {
            let allCompiled = true;
            for (const d of this.compileDeclarations.values()) {
                if (d.compiled) continue;
                allCompiled = false;
                break;
            }

            if (this.embedDeclarations.size === 0 && allCompiled) break;

            for (const [node, d] of [...this.compileDeclarations.entries()]) {
                if (d.compiled) continue;
                d.compiled = this.createProgramVarFromNode(node, d.name, this.sourceFile);
            }

            if (this.embedDeclarations.size) {
                const embedded: Statement[] = [];
                for (const node of this.embedDeclarations.keys()) {
                    this.compiledDeclarations.add(node);
                }
                const entries = Array.from(this.embedDeclarations.entries());
                this.embedDeclarations.clear();
                for (const [node, d] of entries) {
                    embedded.push(...this.createProgramVarFromNode(node, d.name, d.sourceFile));
                }
                this.sourceFile = this.f.updateSourceFile(this.sourceFile, [...embedded, ...this.sourceFile.statements]);
            }
        }

        //externalize type aliases
        const compileDeclarations = (node: Node): any => {
            node = visitEachChild(node, compileDeclarations, this.context);

            if ((isTypeAliasDeclaration(node) || isInterfaceDeclaration(node) || isEnumDeclaration(node))) {
                const d = this.compileDeclarations.get(node);
                if (!d) {
                    return node;
                }
                this.compileDeclarations.delete(node);
                this.compiledDeclarations.add(node);
                if (d.compiled) {
                    return [...d.compiled, node];
                }
            }

            return node;
        };
        this.sourceFile = visitNode(this.sourceFile, compileDeclarations);

        const embedTopExpression: Statement[] = [];
        if (this.addImports.length) {
            const compilerOptions = this.context.getCompilerOptions();
            const handledIdentifier: string[] = [];
            for (const imp of this.addImports) {
                if (handledIdentifier.includes(getIdentifierName(imp.identifier))) continue;
                handledIdentifier.push(getIdentifierName(imp.identifier));
                if (compilerOptions.module === ModuleKind.CommonJS) {
                    //var {identifier} = require('./bar')
                    const variable = this.f.createVariableStatement(undefined, this.f.createVariableDeclarationList([this.f.createVariableDeclaration(
                        this.f.createObjectBindingPattern([this.f.createBindingElement(undefined, undefined, imp.identifier)]),
                        undefined, undefined,
                        this.f.createCallExpression(this.f.createIdentifier('require'), undefined, [imp.from])
                    )], NodeFlags.Const));
                    embedTopExpression.push(variable);
                } else {
                    //import {identifier} from './bar'
                    // import { identifier as identifier } is used to avoid automatic elision of imports (in angular builds for example)
                    // that's probably a bit unstable.
                    const specifier = this.f.createImportSpecifier(false, imp.identifier, imp.identifier);
                    const namedImports = this.f.createNamedImports([specifier]);
                    const importStatement = this.f.createImportDeclaration(undefined, undefined,
                        this.f.createImportClause(false, undefined, namedImports), imp.from
                    );
                    embedTopExpression.push(importStatement);
                }
            }
        }

        if (this.embedAssignType) {
            const assignType = this.f.createFunctionDeclaration(
                undefined,
                undefined,
                undefined,
                this.f.createIdentifier('__assignType'),
                undefined,
                [
                    this.f.createParameterDeclaration(
                        undefined,
                        undefined,
                        undefined,
                        this.f.createIdentifier('fn'),
                        undefined,
                        undefined, //this.f.createKeywordTypeNode(SyntaxKind.AnyKeyword),
                        undefined
                    ),
                    this.f.createParameterDeclaration(
                        undefined,
                        undefined,
                        undefined,
                        this.f.createIdentifier('args'),
                        undefined,
                        undefined, //this.f.createKeywordTypeNode(SyntaxKind.AnyKeyword),
                        undefined
                    )
                ],
                undefined, //this.f.createKeywordTypeNode(SyntaxKind.AnyKeyword),
                this.f.createBlock(
                    [
                        this.f.createExpressionStatement(this.f.createBinaryExpression(
                            this.f.createPropertyAccessExpression(
                                this.f.createIdentifier('fn'),
                                this.f.createIdentifier('__type')
                            ),
                            this.f.createToken(SyntaxKind.EqualsToken),
                            this.f.createIdentifier('args')
                        )),
                        this.f.createReturnStatement(this.f.createIdentifier('fn'))
                    ],
                    true
                )
            );
            embedTopExpression.push(assignType);
        }

        if (this.tempResultIdentifier) {
            embedTopExpression.push(
                this.f.createVariableStatement(
                    undefined,
                    this.f.createVariableDeclarationList(
                        [this.f.createVariableDeclaration(
                            this.tempResultIdentifier,
                            undefined,
                            undefined,
                            undefined
                        )],
                        ts.NodeFlags.None
                    )
                )
            );
        }

        if (embedTopExpression.length) {
            this.sourceFile = this.f.updateSourceFile(this.sourceFile, [...embedTopExpression, ...this.sourceFile.statements]);
        }

        // console.log('transform sourceFile', this.sourceFile.fileName);
        // console.log(createPrinter().printNode(EmitHint.SourceFile, this.sourceFile, this.sourceFile));
        return this.sourceFile;
    }

    protected injectResetΩ<T extends FunctionDeclaration | FunctionExpression | MethodDeclaration | ConstructorDeclaration>(node: T): T {
        let hasReceiveType = false;
        for (const param of node.parameters) {
            if (param.type && getReceiveTypeParameter(param.type)) hasReceiveType = true;
        }
        if (!hasReceiveType) return node;

        let container: Expression = this.f.createIdentifier('globalThis');
        if ((isFunctionDeclaration(node) || isFunctionExpression(node)) && node.name) {
            container = node.name;
        } else if (isMethodDeclaration(node) && isIdentifier(node.name)) {
            container = this.f.createPropertyAccessExpression(this.f.createIdentifier('this'), node.name);
        } else if (isConstructorDeclaration(node)) {
            container = this.f.createPropertyAccessExpression(this.f.createIdentifier('this'), 'constructor');
        }

        const reset: Statement = this.f.createExpressionStatement(this.f.createBinaryExpression(
            this.f.createPropertyAccessExpression(
                container,
                this.f.createIdentifier('Ω')
            ),
            this.f.createToken(ts.SyntaxKind.EqualsToken),
            this.f.createIdentifier('undefined')
        ));
        const body = node.body ? this.f.updateBlock(node.body, [reset, ...node.body.statements]) : undefined;

        if (isFunctionDeclaration(node)) {
            return this.f.updateFunctionDeclaration(node, node.decorators, node.modifiers, node.asteriskToken, node.name,
                node.typeParameters, node.parameters, node.type, body) as T;
        } else if (isFunctionExpression(node)) {
            return this.f.updateFunctionExpression(node, node.modifiers, node.asteriskToken, node.name,
                node.typeParameters, node.parameters, node.type, body || node.body) as T;
        } else if (isMethodDeclaration(node)) {
            return this.f.updateMethodDeclaration(node, node.decorators, node.modifiers, node.asteriskToken, node.name,
                node.questionToken, node.typeParameters, node.parameters, node.type, body) as T;
        } else if (isConstructorDeclaration(node)) {
            return this.f.updateConstructorDeclaration(node, node.decorators, node.modifiers, node.parameters, body) as T;
        }
        return node;
    }

    protected createProgramVarFromNode(node: Node, name: EntityName, sourceFile: SourceFile): Statement[] {
        const typeProgram = new CompilerProgram(node, sourceFile);

        if ((isTypeAliasDeclaration(node) || isInterfaceDeclaration(node)) && node.typeParameters) {
            for (const param of node.typeParameters) {
                if (param.default) {
                    //push default on the stack
                    this.extractPackStructOfType(param.default, typeProgram);
                }
                typeProgram.pushTemplateParameter(getIdentifierName(param.name), !!param.default);
            }
        }

        if (isTypeAliasDeclaration(node)) {
            this.extractPackStructOfType(node.type, typeProgram);
        } else {
            this.extractPackStructOfType(node, typeProgram);
        }
        const typeProgramExpression = this.packOpsAndStack(typeProgram);

        const variable = this.f.createVariableStatement(
            [],
            this.f.createVariableDeclarationList([
                this.f.createVariableDeclaration(
                    this.getDeclarationVariableName(name),
                    undefined,
                    undefined,
                    typeProgramExpression,
                )
            ], NodeFlags.Const),
        );

        //when its commonJS, the `variable` would be exported as `exports.$name = $value`, but all references point just to $name.
        //so the idea is, that we create a normal variable and export it via `export {$name}`.
        if (hasModifier(node, SyntaxKind.ExportKeyword)) {
            //propertyName in ExportSpecifier is set to avoid a TS compile error:
            // TypeError: Cannot read properties of undefined (reading 'escapedText')
            //   at Object.idText (/Users/marc/bude/deepkit-framework/packages/benchmark/node_modules/typescript/lib/typescript.js:11875:67)
            const exportNode = this.f.createExportDeclaration(undefined, undefined, false, this.f.createNamedExports([
                this.f.createExportSpecifier(false, this.getDeclarationVariableName(name), this.getDeclarationVariableName(name))
            ]));
            return [variable, exportNode];
        }

        return [variable];
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
            case SyntaxKind.UnknownKeyword: {
                program.pushOp(ReflectionOp.unknown);
                break;
            }
            case SyntaxKind.ObjectKeyword: {
                program.pushOp(ReflectionOp.object);
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
                //class nodes have always their own program, so the start is always fresh, means we don't need a frame

                if (node) {
                    const members: ClassElement[] = [];

                    if (narrowed.typeParameters) {
                        for (const typeParameter of narrowed.typeParameters) {
                            const name = getNameAsString(typeParameter.name);
                            if (typeParameter.default) {
                                //push default on the stack
                                this.extractPackStructOfType(typeParameter.default, program);
                            }
                            program.pushTemplateParameter(name, !!typeParameter.default);
                        }
                    }

                    if (narrowed.heritageClauses) {
                        for (const heritage of narrowed.heritageClauses) {
                            if (heritage.token === SyntaxKind.ExtendsKeyword) {
                                for (const extendType of heritage.types) {
                                    program.pushFrame();
                                    if (extendType.typeArguments) {
                                        for (const typeArgument of extendType.typeArguments) {
                                            this.extractPackStructOfType(typeArgument, program);
                                        }
                                    }
                                    const index = program.pushStack(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, extendType.expression));
                                    program.pushOp(ReflectionOp.classReference, index);
                                    program.popFrameImplicit();
                                }
                            }
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

                    if (narrowed.heritageClauses && narrowed.heritageClauses[0] && narrowed.heritageClauses[0].types[0]) {
                        const first = narrowed.heritageClauses[0].types[0];
                        if (isExpressionWithTypeArguments(first) && first.typeArguments) {
                            for (const typeArgument of first.typeArguments) {
                                this.extractPackStructOfType(typeArgument, program);
                            }

                            program.pushOp(ReflectionOp.classExtends, first.typeArguments.length);
                        }
                    }

                }
                break;
            }
            case SyntaxKind.IntersectionType: {
                //TypeScript does not narrow types down
                const narrowed = node as IntersectionTypeNode;
                program.pushFrame();

                for (const type of narrowed.types) {
                    this.extractPackStructOfType(type, program);
                }

                program.pushOp(ReflectionOp.intersection);
                program.popFrameImplicit();
                break;
            }
            case SyntaxKind.MappedType: {
                //TypeScript does not narrow types down
                const narrowed = node as MappedTypeNode;

                //<Type>{[Property in keyof Type]: boolean;};
                program.pushFrame();
                program.pushVariable(getIdentifierName(narrowed.typeParameter.name));

                const constraint = getEffectiveConstraintOfTypeParameter(narrowed.typeParameter);
                if (constraint) {
                    this.extractPackStructOfType(constraint, program);
                } else {
                    program.pushOp(ReflectionOp.never);
                }

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
                program.pushCoRoutine();
                if (narrowed.nameType) program.pushFrame();
                if (narrowed.type) {
                    this.extractPackStructOfType(narrowed.type, program);
                } else {
                    program.pushOp(ReflectionOp.never);
                }
                if (narrowed.nameType) {
                    this.extractPackStructOfType(narrowed.nameType, program);
                    program.pushOp(ReflectionOp.tuple);
                    program.popFrameImplicit();
                }
                const coRoutineIndex = program.popCoRoutine();

                if (narrowed.nameType) {
                    program.pushOp(ReflectionOp.mappedType2, coRoutineIndex, modifier);
                } else {
                    program.pushOp(ReflectionOp.mappedType, coRoutineIndex, modifier);
                }

                program.popFrameImplicit();
                break;
            }
            case SyntaxKind.TypeLiteral:
            case SyntaxKind.InterfaceDeclaration: {
                //TypeScript does not narrow types down
                const narrowed = node as TypeLiteralNode | InterfaceDeclaration;
                program.pushFrame();

                //first all extend expressions
                if (isInterfaceDeclaration(narrowed) && narrowed.heritageClauses) {
                    for (const heritage of narrowed.heritageClauses) {
                        if (heritage.token === SyntaxKind.ExtendsKeyword) {
                            for (const extendType of heritage.types) {
                                this.extractPackStructOfTypeReference(extendType, program);
                            }
                        }
                    }
                }

                for (const member of narrowed.members) {
                    this.extractPackStructOfType(member, program);
                }
                program.pushOp(ReflectionOp.objectLiteral);
                program.popFrameImplicit();
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
                        const index = program.findOrAddStackEntry(getIdentifierName(element.name));
                        program.pushOp(ReflectionOp.namedTupleMember, index);
                        if (element.questionToken) {
                            program.pushOp(ReflectionOp.optional);
                        }
                    } else {
                        this.extractPackStructOfType(element, program);
                    }
                }
                program.pushOp(ReflectionOp.tuple);
                program.popFrameImplicit();
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
                    const config = this.findReflectionConfig(narrowed, program);
                    if (config.mode === 'never') return;

                    this.extractPackStructOfType(narrowed.type, program);
                    const name = getPropertyName(this.f, narrowed.name);
                    program.pushOp(ReflectionOp.property, program.findOrAddStackEntry(name));

                    if (narrowed.questionToken) program.pushOp(ReflectionOp.optional);
                    if (hasModifier(narrowed, SyntaxKind.ReadonlyKeyword)) program.pushOp(ReflectionOp.readonly);
                    if (hasModifier(narrowed, SyntaxKind.PrivateKeyword)) program.pushOp(ReflectionOp.private);
                    if (hasModifier(narrowed, SyntaxKind.ProtectedKeyword)) program.pushOp(ReflectionOp.protected);
                    if (hasModifier(narrowed, SyntaxKind.AbstractKeyword)) program.pushOp(ReflectionOp.abstract);
                    if (hasModifier(narrowed, SyntaxKind.StaticKeyword)) program.pushOp(ReflectionOp.static);

                    if (narrowed.initializer) {
                        //important to use Function, since it will be called using a different `this`
                        program.pushOp(ReflectionOp.defaultValue, program.findOrAddStackEntry(this.f.createFunctionExpression(undefined, undefined, undefined, undefined, undefined, undefined,
                            this.f.createBlock([this.f.createReturnStatement(narrowed.initializer)]))
                        ));
                    }

                    const description = extractJSDocAttribute(narrowed, 'description');
                    if (description) program.pushOp(ReflectionOp.description, program.findOrAddStackEntry(description));
                }
                break;
            }
            case SyntaxKind.ConditionalType: {
                //TypeScript does not narrow types down
                const narrowed = node as ConditionalTypeNode;


                // Depending on whether this a distributive conditional type or not, it has to be moved to its own function
                // my understanding of when a distributive conditional type is used is:
                // 1. the `checkType` is a simple identifier (just `T`, no `[T]`, no `T | x`, no `{a: T}`, etc)
                let distributiveOverIdentifier: Identifier | undefined = isTypeReferenceNode(narrowed.checkType) && isIdentifier(narrowed.checkType.typeName) ? narrowed.checkType.typeName : undefined;

                if (distributiveOverIdentifier) {
                    program.pushFrame();
                    //first we add to the stack the origin type we distribute over.
                    this.extractPackStructOfType(narrowed.checkType, program);

                    //since the distributive conditional type is a loop that changes only the found `T`, it is necessary to add that as variable,
                    //so call convention can take over.
                    program.pushVariable(getIdentifierName(distributiveOverIdentifier));
                    program.pushCoRoutine();
                }

                program.pushConditionalFrame(); //gets its own frame for `infer T` ops. all infer variables will be registered in this frame
                this.extractPackStructOfType(narrowed.checkType, program);
                this.extractPackStructOfType(narrowed.extendsType, program);

                program.pushOp(ReflectionOp.extends);

                program.pushCoRoutine();
                this.extractPackStructOfType(narrowed.trueType, program);
                const trueProgram = program.popCoRoutine();

                program.pushCoRoutine();
                this.extractPackStructOfType(narrowed.falseType, program);
                const falseProgram = program.popCoRoutine();

                program.pushOp(ReflectionOp.jumpCondition, trueProgram, falseProgram);
                program.moveFrame(); //pops frame

                if (distributiveOverIdentifier) {
                    const coRoutineIndex = program.popCoRoutine();
                    program.pushOp(ReflectionOp.distribute, coRoutineIndex);
                    program.popFrameImplicit();
                }
                break;
            }
            case SyntaxKind.InferType: {
                //TypeScript does not narrow types down
                const narrowed = node as InferTypeNode;

                const frame = program.findConditionalFrame();
                if (frame) {
                    const typeParameterName = getIdentifierName(narrowed.typeParameter.name);
                    let variable = program.findVariable(typeParameterName);
                    if (!variable) {
                        program.pushVariable(typeParameterName, frame);
                        variable = program.findVariable(typeParameterName);
                        if (!variable) throw new Error('Could not find inserted infer variable');
                    }
                    program.pushOp(ReflectionOp.infer, variable.frameOffset, variable.stackIndex);
                } else {
                    program.pushOp(ReflectionOp.never);
                }
                break;
            }
            case SyntaxKind.MethodSignature:
            case SyntaxKind.MethodDeclaration:
            case SyntaxKind.Constructor:
            case SyntaxKind.ArrowFunction:
            case SyntaxKind.FunctionExpression:
            case SyntaxKind.ConstructSignature:
            case SyntaxKind.ConstructorType:
            case SyntaxKind.FunctionType:
            case SyntaxKind.FunctionDeclaration: {
                //TypeScript does not narrow types down
                const narrowed = node as MethodSignature | MethodDeclaration | ConstructorTypeNode | ConstructSignatureDeclaration | ConstructorDeclaration | ArrowFunction | FunctionExpression | FunctionTypeNode | FunctionDeclaration;

                const config = this.findReflectionConfig(narrowed, program);
                if (config.mode === 'never') return;

                const name = isConstructorTypeNode(narrowed) || isConstructSignatureDeclaration(node) ? 'new' : isConstructorDeclaration(narrowed) ? 'constructor' : getPropertyName(this.f, narrowed.name);
                if (!narrowed.type && narrowed.parameters.length === 0 && !name) return;

                program.pushFrame();
                for (let i = 0; i < narrowed.parameters.length; i++) {
                    const parameter = narrowed.parameters[i];
                    const parameterName = isIdentifier(parameter.name) ? getNameAsString(parameter.name) : 'param' + i;

                    const type = parameter.type ? (parameter.dotDotDotToken && isArrayTypeNode(parameter.type) ? parameter.type.elementType : parameter.type) : undefined;

                    if (type) {
                        this.extractPackStructOfType(type, program);
                    } else {
                        program.pushOp(ReflectionOp.any);
                    }

                    if (parameter.dotDotDotToken) {
                        program.pushOp(ReflectionOp.rest);
                    }

                    program.pushOp(ReflectionOp.parameter, program.findOrAddStackEntry(parameterName));

                    if (parameter.questionToken) program.pushOp(ReflectionOp.optional);
                    if (hasModifier(parameter, SyntaxKind.PublicKeyword)) program.pushOp(ReflectionOp.public);
                    if (hasModifier(parameter, SyntaxKind.PrivateKeyword)) program.pushOp(ReflectionOp.private);
                    if (hasModifier(parameter, SyntaxKind.ProtectedKeyword)) program.pushOp(ReflectionOp.protected);
                    if (hasModifier(parameter, SyntaxKind.ReadonlyKeyword)) program.pushOp(ReflectionOp.readonly);
                    if (parameter.initializer && parameter.type && !getReceiveTypeParameter(parameter.type)) {
                        program.pushOp(ReflectionOp.defaultValue, program.findOrAddStackEntry(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, parameter.initializer)));
                    }
                }

                if (narrowed.type) {
                    this.extractPackStructOfType(narrowed.type, program);
                } else {
                    program.pushOp(ReflectionOp.any);
                }

                program.pushOp(
                    isMethodSignature(narrowed) || isConstructSignatureDeclaration(narrowed)
                        ? ReflectionOp.methodSignature
                        : isMethodDeclaration(narrowed) || isConstructorDeclaration(narrowed)
                            ? ReflectionOp.method : ReflectionOp.function, program.findOrAddStackEntry(name)
                );

                if (isMethodDeclaration(narrowed)) {
                    if (hasModifier(narrowed, SyntaxKind.PrivateKeyword)) program.pushOp(ReflectionOp.private);
                    if (hasModifier(narrowed, SyntaxKind.ProtectedKeyword)) program.pushOp(ReflectionOp.protected);
                    if (hasModifier(narrowed, SyntaxKind.AbstractKeyword)) program.pushOp(ReflectionOp.abstract);
                    if (hasModifier(narrowed, SyntaxKind.StaticKeyword)) program.pushOp(ReflectionOp.static);
                }
                program.popFrameImplicit();
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
            case SyntaxKind.TemplateLiteralType: {
                //TypeScript does not narrow types down
                const narrowed = node as TemplateLiteralTypeNode;

                program.pushFrame();
                if (narrowed.head.rawText) {
                    program.pushOp(ReflectionOp.literal, program.findOrAddStackEntry(narrowed.head.rawText));
                }

                for (const span of narrowed.templateSpans) {
                    this.extractPackStructOfType(span.type, program);
                    if (span.literal.rawText) {
                        program.pushOp(ReflectionOp.literal, program.findOrAddStackEntry(span.literal.rawText));
                    }
                }

                program.pushOp(ReflectionOp.templateLiteral);
                program.popFrameImplicit();

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
                    program.pushFrame();

                    for (const subType of narrowed.types) {
                        this.extractPackStructOfType(subType, program);
                    }

                    program.pushOp(ReflectionOp.union);
                    program.popFrameImplicit();
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
                program.popFrameImplicit();
                break;
            }
            case SyntaxKind.IndexSignature: {
                //TypeScript does not narrow types down
                const narrowed = node as IndexSignatureDeclaration;

                //node.parameters = first item is {[name: string]: number} => 'name: string'
                if (narrowed.parameters.length && narrowed.parameters[0].type) {
                    this.extractPackStructOfType(narrowed.parameters[0].type, program);
                } else {
                    program.pushOp(ReflectionOp.any);
                }

                //node.type = first item is {[name: string]: number} => 'number'
                this.extractPackStructOfType(narrowed.type, program);
                program.pushOp(ReflectionOp.indexSignature);
                break;
            }
            case SyntaxKind.TypeQuery: {
                //TypeScript does not narrow types down
                const narrowed = node as TypeQueryNode;

                // if (program.importSpecifier) {
                //     //if this is set, the current program is embedded into another file. All locally used symbols like a variable in `typeof` need to be imported
                //     //in the other file as well.
                //     if (isIdentifier(narrowed.exprName)) {
                //         const originImportStatement = program.importSpecifier.parent.parent.parent;
                //         this.addImports.push({ identifier: narrowed.exprName, from: originImportStatement.moduleSpecifier });
                //     }
                // }
                if (isIdentifier(narrowed.exprName)) {
                    const resolved = this.resolveDeclaration(narrowed.exprName);
                    if (resolved && findSourceFile(resolved.declaration) !== this.sourceFile && resolved.importDeclaration) {
                        ensureImportIsEmitted(resolved.importDeclaration, narrowed.exprName);
                    }
                }

                const expression = serializeEntityNameAsExpression(this.f, narrowed.exprName);
                program.pushOp(ReflectionOp.typeof, program.pushStack(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, expression)));
                break;
            }
            case SyntaxKind.TypeOperator: {
                //TypeScript does not narrow types down
                const narrowed = node as TypeOperatorNode;

                switch (narrowed.operator) {
                    case SyntaxKind.KeyOfKeyword: {
                        this.extractPackStructOfType(narrowed.type, program);
                        program.pushOp(ReflectionOp.keyof);
                        break;
                    }
                    case SyntaxKind.ReadonlyKeyword: {
                        this.extractPackStructOfType(narrowed.type, program);
                        program.pushOp(ReflectionOp.readonly);
                        break;
                    }
                    default: {
                        program.pushOp(ReflectionOp.never);
                    }
                }
                break;
            }
            case SyntaxKind.IndexedAccessType: {
                //TypeScript does not narrow types down
                const narrowed = node as IndexedAccessTypeNode;

                this.extractPackStructOfType(narrowed.objectType, program);
                this.extractPackStructOfType(narrowed.indexType, program);
                program.pushOp(ReflectionOp.indexAccess);
                break;
            }
            case SyntaxKind.Identifier: {
                //TypeScript does not narrow types down
                const narrowed = node as Identifier;

                //check if it references a variable
                const variable = program.findVariable(getIdentifierName(narrowed));
                if (variable) {
                    program.pushOp(ReflectionOp.loads, variable.frameOffset, variable.stackIndex);
                }
                break;
            }
            default: {
                program.pushOp(ReflectionOp.never);
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
        'RegExp': ReflectionOp.regexp,
        'String': ReflectionOp.string,
        'Number': ReflectionOp.number,
        'BigInt': ReflectionOp.bigint,
        'Boolean': ReflectionOp.boolean,
    };

    protected globalSourceFiles?: SourceFile[];

    protected getGlobalLibs(): SourceFile[] {
        if (this.globalSourceFiles) return this.globalSourceFiles;

        this.globalSourceFiles = [];

        //todo also read compiler options "types" + typeRoot

        const libs = knownLibFilesForCompilerOptions(this.context.getCompilerOptions(), ts);

        for (const lib of libs) {
            const sourceFile = this.resolver.resolveSourceFile(this.sourceFile.fileName, 'typescript/lib/' + lib.replace('.d.ts', ''));
            if (!sourceFile) continue;
            this.globalSourceFiles.push(sourceFile);
        }
        return this.globalSourceFiles;
    }

    /**
     * This is a custom resolver based on populated `locals` from the binder. It uses a custom resolution algorithm since
     * we have no access to the binder/TypeChecker directly and instantiating a TypeChecker per file/transformer is incredible slow.
     */
    protected resolveDeclaration(typeName: EntityName): { declaration: Declaration, importDeclaration?: ImportDeclaration, typeOnly?: boolean } | void {
        let current: Node = typeName.parent;
        if (typeName.kind === SyntaxKind.QualifiedName) return; //namespace access not supported yet, e.g. type a = Namespace.X;

        let declaration: Declaration | undefined = undefined;

        while (current) {
            if (isNodeWithLocals(current) && current.locals) {
                const found = current.locals.get(typeName.escapedText);
                if (found && found.declarations && found.declarations[0]) {
                    declaration = found.declarations[0];
                    break;
                }
            }

            if (current.kind === SyntaxKind.SourceFile) break;
            current = current.parent;
        }

        if (!declaration) {
            // look in globals, read through all files, see checker.ts initializeTypeChecker
            for (const file of this.getGlobalLibs()) {
                const globals = getGlobalsOfSourceFile(file);
                if (!globals) continue;
                const symbol = globals.get(typeName.escapedText);
                if (symbol && symbol.declarations && symbol.declarations[0]) {
                    declaration = symbol.declarations[0];
                    // console.log('found global', typeName.escapedText, 'in', file.fileName);
                    break;
                }
            }
        }

        let importDeclaration: ImportDeclaration | undefined = undefined;
        let typeOnly = false;

        if (declaration && isImportSpecifier(declaration)) {
            if (declaration.isTypeOnly) typeOnly = true;
            importDeclaration = declaration.parent.parent.parent;
        } else if (declaration && isImportDeclaration(declaration)) {
            // declaration = this.resolveImportSpecifier(typeName.escapedText, declaration);
            importDeclaration = declaration;
        } else if (declaration && isImportClause(declaration)) {
            importDeclaration = declaration.parent;
        }

        if (importDeclaration) {
            if (importDeclaration.importClause && importDeclaration.importClause.isTypeOnly) typeOnly = true;
            declaration = this.resolveImportSpecifier(typeName.escapedText, importDeclaration, this.sourceFile);
        }

        if (declaration && declaration.kind === SyntaxKind.TypeParameter && declaration.parent.kind === SyntaxKind.TypeAliasDeclaration) {
            //for alias like `type MyAlias<T> = T`, `T` is returned from `typeChecker.getDeclaredTypeOfSymbol(symbol)`.
            declaration = declaration.parent as TypeAliasDeclaration;
        }

        if (!declaration) return;

        return { declaration, importDeclaration, typeOnly };
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

    protected getDeclarationVariableName(typeName: EntityName): Identifier {
        if (isIdentifier(typeName)) {
            return this.f.createIdentifier('__Ω' + getIdentifierName(typeName));
        }

        function joinQualifiedName(name: EntityName): string {
            if (isIdentifier(name)) return getIdentifierName(name);
            return joinQualifiedName(name.left) + '_' + getIdentifierName(name.right);
        }

        return this.f.createIdentifier('__Ω' + joinQualifiedName(typeName));
    }

    protected extractPackStructOfTypeReference(type: TypeReferenceNode | ExpressionWithTypeArguments, program: CompilerProgram): void {
        const typeName: EntityName | undefined = isTypeReferenceNode(type) ? type.typeName : (isIdentifier(type.expression) ? type.expression : undefined);
        if (!typeName) {
            program.pushOp(ReflectionOp.any);
            return;
        }

        if (isIdentifier(typeName) && getIdentifierName(typeName) === 'InlineRuntimeType' && type.typeArguments && type.typeArguments[0] && isTypeQueryNode(type.typeArguments[0])) {
            const expression = serializeEntityNameAsExpression(this.f, type.typeArguments[0].exprName);
            program.pushOp(ReflectionOp.arg, program.pushStack(expression));
            return;
        }

        if (isIdentifier(typeName) && getIdentifierName(typeName) !== 'constructor' && this.knownClasses[getIdentifierName(typeName)]) {
            const name = getIdentifierName(typeName);
            const op = this.knownClasses[name];
            program.pushOp(op);
        } else if (isIdentifier(typeName) && getIdentifierName(typeName) === 'Promise') {
            //promise has always one sub type
            if (type.typeArguments && type.typeArguments[0]) {
                this.extractPackStructOfType(type.typeArguments[0], program);
            } else {
                program.pushOp(ReflectionOp.any);
            }
            program.pushOp(ReflectionOp.promise);
        } else if (isIdentifier(typeName) && getIdentifierName(typeName) === 'integer') {
            program.pushOp(ReflectionOp.numberBrand, TypeNumberBrand.integer as number);
        } else if (isIdentifier(typeName) && getIdentifierName(typeName) !== 'constructor' && TypeNumberBrand[getIdentifierName(typeName) as any] !== undefined) {
            program.pushOp(ReflectionOp.numberBrand, TypeNumberBrand[getIdentifierName(typeName) as any] as any);
        } else {
            //check if it references a variable
            if (isIdentifier(typeName)) {
                const variable = program.findVariable(getIdentifierName(typeName));
                if (variable) {
                    program.pushOp(ReflectionOp.loads, variable.frameOffset, variable.stackIndex);
                    return;
                }
            } else if (isInferTypeNode(typeName)) {
                this.extractPackStructOfType(typeName, program);
                return;
            }

            const resolved = this.resolveDeclaration(typeName);
            if (!resolved) {
                //maybe reference to enum
                if (isQualifiedName(typeName)) {
                    if (isIdentifier(typeName.left)) {
                        const resolved = this.resolveDeclaration(typeName.left);
                        if (resolved && isEnumDeclaration(resolved.declaration)) {
                            let lastExpression: Expression | undefined;
                            let indexValue: number = 0;
                            for (const member of resolved.declaration.members) {
                                if (getNameAsString(member.name) === getNameAsString(typeName.right)) {
                                    if (member.initializer) {
                                        program.pushOp(ReflectionOp.arg, program.pushStack(this.nodeConverter.toExpression(member.initializer)));
                                    } else if (lastExpression) {
                                        const exp = this.nodeConverter.toExpression(lastExpression);
                                        program.pushOp(ReflectionOp.arg, program.pushStack(
                                            this.f.createBinaryExpression(exp, SyntaxKind.PlusToken, this.nodeConverter.toExpression(indexValue))
                                        ));
                                    } else {
                                        program.pushOp(ReflectionOp.arg, program.pushStack(this.nodeConverter.toExpression(indexValue)));
                                    }
                                    return;
                                } else {
                                    indexValue++;
                                    if (member.initializer) {
                                        lastExpression = member.initializer;
                                        //restart index
                                        indexValue = 0;
                                    }
                                }
                            }
                        }
                    }
                }

                //non-existing references are ignored.
                program.pushOp(ReflectionOp.never);
                return;
            }

            const declaration = resolved.declaration;
            if (isModuleDeclaration(declaration) && resolved.importDeclaration) {
                if (isIdentifier(typeName)) ensureImportIsEmitted(resolved.importDeclaration, typeName);

                //we can not infer from module declaration, so do `typeof T` in runtime
                program.pushOp(ReflectionOp.typeof, program.pushStack(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, serializeEntityNameAsExpression(this.f, typeName))));
            } else if (isTypeAliasDeclaration(declaration) || isInterfaceDeclaration(declaration) || isEnumDeclaration(declaration)) {
                //Set/Map are interface declarations
                const name = getNameAsString(typeName);
                if (name === 'Array') {
                    if (type.typeArguments && type.typeArguments[0]) {
                        this.extractPackStructOfType(type.typeArguments[0], program);
                    } else {
                        program.pushOp(ReflectionOp.any);
                    }

                    program.pushOp(ReflectionOp.array);
                    return;
                } else if (name === 'Function') {
                    program.pushOp(ReflectionOp.frame);
                    program.pushOp(ReflectionOp.any);
                    program.pushOp(ReflectionOp.function, program.pushStack(''));
                    return;
                } else if (name === 'Set') {
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

                //to break recursion, we track which declaration has already been compiled
                if (!this.compiledDeclarations.has(declaration) && !this.compileDeclarations.has(declaration)) {
                    const declarationSourceFile = findSourceFile(declaration) || this.sourceFile;
                    const isGlobal = resolved.importDeclaration === undefined && declarationSourceFile.fileName !== this.sourceFile.fileName;
                    const isFromImport = resolved.importDeclaration !== undefined;

                    if (isGlobal) {
                        //we don't embed non-global imported declarations anymore, only globals
                        this.embedDeclarations.set(declaration, {
                            name: typeName,
                            sourceFile: declarationSourceFile
                        });
                    } else if (isFromImport) {
                        if (resolved.importDeclaration) {
                            //if explicit `import {type T}`, we do not emit an import and instead push any
                            if (resolved.typeOnly) {
                                program.pushOp(ReflectionOp.any);
                                return;
                            }

                            // //check if the referenced declaration has reflection disabled
                            const declarationReflection = this.findReflectionConfig(declaration, program);
                            if (declarationReflection.mode === 'never') {
                                program.pushOp(ReflectionOp.any);
                                return;
                            }

                            const found = this.resolver.resolve(this.sourceFile, resolved.importDeclaration);
                            if (!found) {
                                debug('module not found');
                                program.pushOp(ReflectionOp.any);
                                return;
                            }

                            // check if this is a viable option:
                            // //check if the referenced file has reflection info emitted. if not, any is emitted for that reference
                            // const typeVar = this.getDeclarationVariableName(typeName);
                            // //check if typeVar is exported in referenced file
                            // const builtType = isNodeWithLocals(found) && found.locals && found.locals.has(typeVar.escapedText);
                            // if (!builtType) {
                            //     program.pushOp(ReflectionOp.any);
                            //     return;
                            // }

                            //check if the referenced file has reflection info emitted. if not, any is emitted for that reference
                            const reflection = this.findReflectionFromPath(found.fileName);
                            if (reflection.mode === 'never') {
                                program.pushOp(ReflectionOp.any);
                                return;
                            }

                            // this.addImports.push({ identifier: typeVar, from: resolved.importDeclaration.moduleSpecifier });
                            this.addImports.push({ identifier: this.getDeclarationVariableName(typeName), from: resolved.importDeclaration.moduleSpecifier });
                        }
                    } else {
                        //it's a reference type inside the same file. Make sure its type is reflected
                        const reflection = this.findReflectionConfig(declaration, program);
                        if (reflection.mode === 'never') {
                            program.pushOp(ReflectionOp.any);
                            return;
                        }

                        this.compileDeclarations.set(declaration, {
                            name: typeName,
                            sourceFile: declarationSourceFile,
                        });
                    }
                }

                const index = program.pushStack(program.forNode === declaration ? 0 : this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, this.getDeclarationVariableName(typeName)));
                if (type.typeArguments) {
                    for (const argument of type.typeArguments) {
                        this.extractPackStructOfType(argument, program);
                    }
                    program.pushOp(ReflectionOp.inlineCall, index, type.typeArguments.length);
                } else {
                    program.pushOp(ReflectionOp.inline, index);
                }

                // if (type.typeArguments) {
                //     for (const argument of type.typeArguments) {
                //         this.extractPackStructOfType(argument, program);
                //     }
                //     program.pushOp(ReflectionOp.inlineCall, index, type.typeArguments.length);
                // } else {
                //     program.pushOp(ReflectionOp.inline, index);
                // }
                // } else if (isTypeLiteralNode(declaration)) {
                //     this.extractPackStructOfType(declaration, program);
                //     return;
                // } else if (isMappedTypeNode(declaration)) {
                //     //<Type>{[Property in keyof Type]: boolean;};
                //     this.extractPackStructOfType(declaration, program);
                //     return;
            } else if (isClassDeclaration(declaration)) {
                //if explicit `import {type T}`, we do not emit an import and instead push any
                if (resolved.typeOnly) {
                    program.pushOp(ReflectionOp.any);
                    return;
                }

                if (resolved.importDeclaration && isIdentifier(typeName)) ensureImportIsEmitted(resolved.importDeclaration, typeName);
                program.pushFrame();
                if (type.typeArguments) {
                    for (const typeArgument of type.typeArguments) {
                        this.extractPackStructOfType(typeArgument, program);
                    }
                }
                const body = isIdentifier(typeName) ? typeName : this.createAccessorForEntityName(typeName);
                const index = program.pushStack(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, body));
                program.pushOp(ReflectionOp.classReference, index);
                program.popFrameImplicit();
            } else if (isTypeParameterDeclaration(declaration)) {
                this.resolveTypeParameter(declaration, type, program);
            } else {
                this.extractPackStructOfType(declaration, program);
            }
        }
    }

    /**
     * Returns the class declaration, function/arrow declaration, or block where type was used.
     */
    protected getTypeUser(type: Node): Node {
        let current: Node = type;
        while (current) {
            if (current.kind === SyntaxKind.Block) return current; //return the block
            if (current.kind === SyntaxKind.ClassDeclaration) return current; //return the class
            if (current.kind === SyntaxKind.ClassExpression) return current; //return the class
            if (current.kind === SyntaxKind.Constructor) return current.parent; //return the class
            if (current.kind === SyntaxKind.MethodDeclaration) return current.parent; //return the class
            if (current.kind === SyntaxKind.ArrowFunction || current.kind === SyntaxKind.FunctionDeclaration || current.kind === SyntaxKind.FunctionExpression) return current;

            current = current.parent;
        }
        return current;
    }

    /**
     * With this function we want to check if `type` is used in the signature itself from the parent of `declaration`.
     * If so, we do not try to infer the type from runtime values.
     *
     * Examples where we do not infer from runtime, `type` being `T` and `declaration` being `<T>` (return false):
     *
     * ```typescript
     * class User<T> {
     *     config: T;
     * }
     *
     * class User<T> {
     *    constructor(public config: T) {}
     * }
     *
     * function do<T>(item: T): void {}
     * function do<T>(item: T): T {}
     * ```
     *
     * Examples where we infer from runtime (return true):
     *
     * ```typescript
     * function do<T>(item: T) {
     *     return typeOf<T>; //<-- because of that
     * }
     *
     * function do<T>(item: T) {
     *     class A {
     *         config: T; //<-- because of that
     *     }
     *     return A;
     * }
     *
     * function do<T>(item: T) {
     *     class A {
     *         doIt() {
     *             class B {
     *                 config: T; //<-- because of that
     *             }
     *             return B;
     *         }
     *     }
     *     return A;
     * }
     *
     * function do<T>(item: T) {
     *     class A {
     *         doIt(): T { //<-- because of that
     *         }
     *     }
     *     return A;
     * }
     * ```
     */
    protected needsToBeInferred(declaration: TypeParameterDeclaration, type: TypeReferenceNode | ExpressionWithTypeArguments): boolean {
        const declarationUser = this.getTypeUser(declaration);
        const typeUser = this.getTypeUser(type);

        return declarationUser !== typeUser;
    }

    protected resolveTypeParameter(declaration: TypeParameterDeclaration, type: TypeReferenceNode | ExpressionWithTypeArguments, program: CompilerProgram) {
        //check if `type` was used in an expression. if so, we need to resolve it from runtime, otherwise we mark it as T
        const isUsedInFunction = isFunctionLike(declaration.parent);
        const resolveRuntimeTypeParameter = (isUsedInFunction && program.isResolveFunctionParameters(declaration.parent)) || (this.needsToBeInferred(declaration, type));

        if (resolveRuntimeTypeParameter) {
            //go through all parameters and look where `type.name.escapedText` is used (recursively).
            //go through all found parameters and replace `T` with `infer T` and embed its type in `typeof parameter extends Type<infer T> ? T : never`, if T is not directly used
            const argumentName = declaration.name.escapedText as string; //T
            const foundUsers: { type: Node, parameterName: Identifier }[] = [];

            if (isUsedInFunction) {
                for (const parameter of (declaration.parent as SignatureDeclaration).parameters) {
                    if (!parameter.type) continue;
                    //if deeply available?
                    let found = false;
                    const searchArgument = (node: Node): Node => {
                        node = visitEachChild(node, searchArgument, this.context);

                        if (isIdentifier(node) && node.escapedText === argumentName) {
                            //transform to infer T
                            found = true;
                            node = this.f.createInferTypeNode(declaration);
                        }

                        return node;
                    };

                    const updatedParameterType = visitEachChild(parameter.type, searchArgument, this.context);
                    if (found && isIdentifier(parameter.name)) {
                        foundUsers.push({ type: updatedParameterType, parameterName: parameter.name });
                    }
                }
            }

            if (foundUsers.length) {
                //todo: if there are multiple infers, we need to create an intersection
                if (foundUsers.length > 1) {
                    //todo: intersection start
                }

                for (const foundUser of foundUsers) {
                    program.pushConditionalFrame();

                    program.pushOp(ReflectionOp.typeof, program.pushStack(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, foundUser.parameterName)));
                    this.extractPackStructOfType(foundUser.type, program);
                    program.pushOp(ReflectionOp.extends);

                    const found = program.findVariable(getIdentifierName(declaration.name));
                    if (found) {
                        this.extractPackStructOfType(declaration.name, program);
                    } else {
                        //type parameter was never found in X of `Y extends X` (no `infer X` was created), probably due to a not supported parameter type expression.
                        program.pushOp(ReflectionOp.any);
                    }
                    this.extractPackStructOfType({ kind: SyntaxKind.NeverKeyword } as TypeNode, program);
                    program.pushOp(ReflectionOp.condition);
                    program.popFrameImplicit();
                }

                if (foundUsers.length > 1) {
                    //todo: intersection end
                }

            } else if (declaration.constraint) {
                if (isUsedInFunction) program.resolveFunctionParametersIncrease(declaration.parent);
                const constraint = getEffectiveConstraintOfTypeParameter(declaration);
                if (constraint) {
                    this.extractPackStructOfType(constraint, program);
                } else {
                    program.pushOp(ReflectionOp.never);
                }
                if (isUsedInFunction) program.resolveFunctionParametersDecrease(declaration.parent);
            } else {
                program.pushOp(ReflectionOp.never);
            }
        } else {
            program.pushOp(ReflectionOp.any);
            // program.pushOp(ReflectionOp.typeParameter, program.findOrAddStackEntry(getNameAsString(typeName)));
        }
    }

    protected createAccessorForEntityName(e: QualifiedName): PropertyAccessExpression {
        return this.f.createPropertyAccessExpression(isIdentifier(e.left) ? e.left : this.createAccessorForEntityName(e.left), e.right);
    }

    protected findDeclarationInFile(sourceFile: SourceFile | ModuleDeclaration, declarationName: __String): Declaration | undefined {
        if (isNodeWithLocals(sourceFile) && sourceFile.locals) {
            const declarationSymbol = sourceFile.locals.get(declarationName);
            if (declarationSymbol && declarationSymbol.declarations && declarationSymbol.declarations[0]) {
                return declarationSymbol.declarations[0];
            }
        }
        return;
    }

    protected resolveImportSpecifier(declarationName: __String, importOrExport: ExportDeclaration | ImportDeclaration, sourceFile: SourceFile): Declaration | undefined {
        if (!importOrExport.moduleSpecifier) return;
        if (!isStringLiteral(importOrExport.moduleSpecifier)) return;

        let source: SourceFile | ModuleDeclaration | undefined = this.resolver.resolve(sourceFile, importOrExport);

        if (!source) {
            debug('module not found', (importOrExport as any).text, 'Is transpileOnly enabled? It needs to be disabled.');
            return;
        }

        const declaration = this.findDeclarationInFile(source, declarationName);

        /**
         * declaration could also be `import {PrimaryKey} from 'xy'`, which we want to skip
         */
        if (declaration && !isImportSpecifier(declaration)) {
            //if `export {PrimaryKey} from 'xy'`, then follow xy
            if (isExportDeclaration(declaration)) {
                return this.followExport(declarationName, declaration, source);
            }
            return declaration;
        }

        //not found, look in exports
        if (isSourceFile(source)) {
            for (const statement of source.statements) {
                if (!isExportDeclaration(statement)) continue;
                const found = this.followExport(declarationName, statement, source);
                if (found) return found;
            }
        }

        return;
    }

    protected followExport(declarationName: __String, statement: ExportDeclaration, sourceFile: SourceFile): Declaration | undefined {
        if (statement.exportClause) {
            //export {y} from 'x'
            if (isNamedExports(statement.exportClause)) {
                for (const element of statement.exportClause.elements) {
                    //see if declarationName is exported
                    if (element.name.escapedText === declarationName) {
                        const found = this.resolveImportSpecifier(element.propertyName ? element.propertyName.escapedText : declarationName, statement, sourceFile);
                        if (found) return found;
                    }
                }
            }
        } else {
            //export * from 'x'
            //see if `x` exports declarationName (or one of its exports * from 'y')
            const found = this.resolveImportSpecifier(declarationName, statement, sourceFile);
            if (found) {
                return found;
            }
        }
        return;
    }

    protected getTypeOfType(type: Node | Declaration): Expression | undefined {
        const reflection = this.findReflectionConfig(type);
        if (reflection.mode === 'never') return;

        const program = new CompilerProgram(type, this.sourceFile);
        this.extractPackStructOfType(type, program);
        return this.packOpsAndStack(program);
    }

    protected packOpsAndStack(program: CompilerProgram) {
        const packStruct = program.buildPackStruct();
        if (packStruct.ops.length === 0) return;
        // debugPackStruct(this.sourceFile, program.forNode, packStruct);
        const packed = [...packStruct.stack, encodeOps(packStruct.ops)];
        return this.valueToExpression(packed);
    }

    /**
     * Note: We have to duplicate the expressions as it can be that incoming expression are from another file and contain wrong pos/end properties,
     * so the code generation is then broken when we simply reuse them. Wrong code like ``User.__type = [.toEqual({`` is then generated.
     * This function is probably not complete, but we add new copies when required.
     */
    protected valueToExpression(value: undefined | PackExpression | PackExpression[]): Expression {
        return this.nodeConverter.toExpression(value);
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
        if (reflection.mode === 'never') {
            return node;
        }
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
     * => const fn = __assignType(function() {}, [34])
     */
    protected decorateFunctionExpression(expression: FunctionExpression) {
        const encodedType = this.getTypeOfType(expression);
        if (!encodedType) return expression;

        return this.wrapWithAssignType(expression, encodedType);
    }

    /**
     * function name() {}
     *
     * => function name() {}; name.__type = 34;
     */
    protected decorateFunctionDeclaration(declaration: FunctionDeclaration) {

        const encodedType = this.getTypeOfType(declaration);
        if (!encodedType) return declaration;

        if (!declaration.name) {
            //its likely `export default function() {}`
            if (!declaration.body) return;

            //since a new default export is created, we do not need ExportKey&DefaultKeyword on the function anymore,
            //but it should preserve all others like Async.
            const modifier = declaration.modifiers ? declaration.modifiers.filter(v => v.kind !== SyntaxKind.ExportKeyword && v.kind !== SyntaxKind.DefaultKeyword) : [];
            return this.f.createExportAssignment(undefined, undefined, undefined, this.wrapWithAssignType(
                this.f.createFunctionExpression(modifier, declaration.asteriskToken, declaration.name, declaration.typeParameters, declaration.parameters, declaration.type, declaration.body),
                encodedType
            ));
        }

        const statements: Statement[] = [declaration];
        statements.push(this.f.createExpressionStatement(
            this.f.createAssignment(this.f.createPropertyAccessExpression(this.nodeConverter.clone(declaration.name), '__type'), encodedType)
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

        return this.wrapWithAssignType(expression, encodedType);
    }

    /**
     * Object.assign(fn, {__type: []}) is much slower than a custom implementation like
     *
     * assignType(fn, [])
     *
     * where we embed assignType() at the beginning of the type.
     */
    protected wrapWithAssignType(fn: Expression, type: Expression) {
        this.embedAssignType = true;

        return this.f.createCallExpression(
            this.f.createIdentifier('__assignType'),
            undefined,
            [
                fn,
                type
            ]
        );
    }

    protected parseReflectionMode(mode?: typeof reflectionModes[number] | '' | boolean | string[], configPathDir?: string): typeof reflectionModes[number] {
        if (Array.isArray(mode)) {
            if (!configPathDir) return 'never';
            if (this.sourceFile.fileName.startsWith(configPathDir)) {
                const fileName = this.sourceFile.fileName.slice(configPathDir.length + 1);
                for (const entry of mode) {
                    if (entry === fileName) return 'default';
                }
            }
            return 'never';
        }
        if ('boolean' === typeof mode) return mode ? 'default' : 'never';
        return mode || 'never';
    }

    protected resolvedTsConfig: { [path: string]: { data: Record<string, any>, exists: boolean } } = {};
    protected resolvedPackageJson: { [path: string]: { data: Record<string, any>, exists: boolean } } = {};

    protected findReflectionConfig(node: Node, program?: CompilerProgram): { mode: typeof reflectionModes[number] } {
        if (program && program.sourceFile.fileName !== this.sourceFile.fileName) {
            //when the node is from another module it was already decided that it will be reflected, so
            //make sure it returns correct mode. for globals this would read otherwise to `mode: never`.
            return { mode: 'always' };
        }

        let current: Node | undefined = node;
        let reflection: typeof reflectionModes[number] | undefined;

        do {
            const tags = getJSDocTags(current);
            for (const tag of tags) {
                if (!reflection && getIdentifierName(tag.tagName) === 'reflection' && 'string' === typeof tag.comment) {
                    return { mode: this.parseReflectionMode(tag.comment as any || true) };
                }
            }
            current = current.parent;
        } while (current);

        //nothing found, look in tsconfig.json
        if (this.reflectionMode !== undefined) return { mode: this.reflectionMode };

        if (!serverEnv) {
            return { mode: 'default' };
        }

        const sourceFile = findSourceFile(node) || this.sourceFile;
        return this.findReflectionFromPath(sourceFile.fileName);
    }

    protected findReflectionFromPath(path: string): { mode: typeof reflectionModes[number] } {
        if (!serverEnv) {
            return { mode: 'default' };
        }

        let currentDir = dirname(path);
        let reflection: typeof reflectionModes[number] | undefined;

        while (currentDir) {
            const packageJsonPath = join(currentDir, 'package.json');
            const tsConfigPath = join(currentDir, 'tsconfig.json');

            let packageJson: Record<string, any> = {};
            let tsConfig: Record<string, any> = {};

            const packageJsonCache = this.resolvedPackageJson[packageJsonPath];
            let packageJsonExists = false;

            if (packageJsonCache) {
                packageJson = packageJsonCache.data;
                packageJsonExists = packageJsonCache.exists;
            } else {
                packageJsonExists = existsSync(packageJsonPath);
                this.resolvedPackageJson[packageJsonPath] = { exists: packageJsonExists, data: {} };
                if (packageJsonExists) {
                    try {
                        let content = readFileSync(packageJsonPath, 'utf8');
                        content = stripJsonComments(content);
                        packageJson = JSON.parse(content);
                        this.resolvedPackageJson[packageJsonPath].data = packageJson;
                    } catch (error: any) {
                        console.warn(`Could not parse ${packageJsonPath}: ${error}`);
                    }
                }
            }

            const tsConfigCache = this.resolvedTsConfig[tsConfigPath];
            let tsConfigExists = false;

            if (tsConfigCache) {
                tsConfig = tsConfigCache.data;
                tsConfigExists = tsConfigCache.exists;
            } else {
                tsConfigExists = existsSync(tsConfigPath);
                this.resolvedTsConfig[tsConfigPath] = { exists: tsConfigExists, data: {} };
                if (tsConfigExists) {
                    try {
                        let content = readFileSync(tsConfigPath, 'utf8');
                        content = stripJsonComments(content);
                        tsConfig = JSON.parse(content);
                        this.resolvedTsConfig[tsConfigPath].data = tsConfig;
                    } catch (error: any) {
                        console.warn(`Could not parse ${tsConfigPath}: ${error}`);
                    }
                }
            }

            if (reflection === undefined && packageJson.reflection !== undefined) {
                return { mode: this.parseReflectionMode(packageJson.reflection, currentDir) };
            }

            if (reflection === undefined && tsConfig.reflection !== undefined) {
                return { mode: this.parseReflectionMode(tsConfig.reflection, currentDir) };
            }

            if (packageJsonExists) {
                //we end the search at package.json so that package in node_modules without reflection option
                //do not inherit the tsconfig from the project.
                break;
            }

            const next = join(currentDir, '..');
            if (resolve(next) === resolve(currentDir)) break; //we are at root
            currentDir = next;
        }

        return { mode: reflection || 'never' };
    }
}

export class DeclarationTransformer extends ReflectionTransformer {

    protected addExports: { identifier: string }[] = [];

    transformSourceFile(sourceFile: SourceFile): SourceFile {
        if ((sourceFile as any).deepkitDeclarationTransformed) return sourceFile;
        (sourceFile as any).deepkitDeclarationTransformed = true;

        this.sourceFile = sourceFile;
        this.addExports = [];

        const reflection = this.findReflectionConfig(sourceFile);
        if (reflection.mode === 'never') {
            return sourceFile;
        }

        const visitor = (node: Node): any => {
            node = visitEachChild(node, visitor, this.context);

            if ((isTypeAliasDeclaration(node) || isInterfaceDeclaration(node)) && hasModifier(node, SyntaxKind.ExportKeyword)) {
                const reflection = this.findReflectionConfig((node as any).original || node); //original needed here since TS does not emit jsDoc in the declaration transformer. I don't know why.
                if (reflection.mode !== 'never') {
                    this.addExports.push({ identifier: getIdentifierName(this.getDeclarationVariableName(node.name)) });
                }
            }

            return node;
        };
        this.sourceFile = visitNode(this.sourceFile, visitor);

        if (this.addExports.length) {
            const exports: Statement[] = [];
            const handledIdentifier: string[] = [];
            for (const imp of this.addExports) {
                if (handledIdentifier.includes(imp.identifier)) continue;
                handledIdentifier.push(imp.identifier);

                //export declare type __ΩXY = any[];
                exports.push(this.f.createTypeAliasDeclaration(undefined, [
                        this.f.createModifier(SyntaxKind.ExportKeyword),
                        this.f.createModifier(SyntaxKind.DeclareKeyword)
                    ], this.f.createIdentifier(imp.identifier),
                    undefined,
                    this.f.createArrayTypeNode(this.f.createKeywordTypeNode(SyntaxKind.AnyKeyword))
                ));
            }

            this.sourceFile = this.f.updateSourceFile(this.sourceFile, [...this.sourceFile.statements, ...exports]);
        }

        return this.sourceFile;
    }
}

let loaded = false;

export const transformer: CustomTransformerFactory = function deepkitTransformer(context) {
    if (!loaded) {
        debug('@deepkit/type transformer loaded\n');
        loaded = true;
    }
    return new ReflectionTransformer(context);
};

export const declarationTransformer: CustomTransformerFactory = function deepkitDeclarationTransformer(context) {
    return new DeclarationTransformer(context);
};

