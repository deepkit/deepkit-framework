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
    Bundle,
    ClassDeclaration,
    ClassElement,
    ClassExpression,
    ConditionalTypeNode,
    ConstructorDeclaration,
    ConstructorTypeNode,
    ConstructSignatureDeclaration,
    createCompilerHost,
    createPrinter,
    createProgram,
    CustomTransformerFactory,
    Declaration,
    EmitHint,
    EntityName,
    EnumDeclaration,
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
    ImportSpecifier,
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
    isImportSpecifier,
    isInferTypeNode,
    isInterfaceDeclaration,
    isMappedTypeNode,
    isMethodDeclaration,
    isMethodSignature,
    isNamedExports,
    isNamedTupleMember,
    isObjectLiteralExpression,
    isOptionalTypeNode,
    isParenthesizedTypeNode,
    isPropertyAccessExpression,
    isStringLiteral,
    isTypeAliasDeclaration,
    isTypeLiteralNode,
    isTypeParameterDeclaration,
    isTypeReferenceNode,
    isUnionTypeNode,
    LiteralTypeNode,
    MappedTypeNode,
    MethodDeclaration,
    MethodSignature,
    ModifierFlags,
    ModuleKind,
    Node,
    NodeFactory,
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
    TypeQueryNode,
    TypeReferenceNode,
    UnionTypeNode,
    visitEachChild,
    visitNode,
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
} from './reflection-ast';
import { EmitHost, EmitResolver, SourceFile } from './ts-types';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import stripJsonComments from 'strip-json-comments';
import { MappedModifier, ReflectionOp, TypeNumberBrand } from './type';
import { encodeOps } from './processor';

export const packSizeByte: number = 6;

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
    [ReflectionOp.enum]: { params: 1 },
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
        if (ReflectionOp[op] === undefined) {
            throw new Error(`Operator ${op} does not exist at position ${i}`);
        }
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

function findSourceFile(declaration: Declaration): SourceFile {
    let current = declaration.parent;
    while (current.kind !== SyntaxKind.SourceFile) {
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

    public importSpecifier?: ImportSpecifier;

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

/**
 * Read the TypeScript AST and generate pack struct (instructions + pre-defined stack).
 *
 * This transformer extracts type and add the encoded (so its small and low overhead) at classes and functions as property.
 *
 * Deepkit/type can then extract and decode them on-demand.
 */
export class ReflectionTransformer {
    sourceFile!: SourceFile;
    protected host: EmitHost;
    protected resolver: EmitResolver;
    protected f: NodeFactory;

    protected reflectionMode?: typeof reflectionModes[number];

    /**
     * Types added to this map will get a type program directly under it.
     * This is for types used in the very same file.
     */
    protected compileDeclarations = new Map<TypeAliasDeclaration | InterfaceDeclaration | EnumDeclaration, { name: EntityName, sourceFile: SourceFile, importSpecifier?: ImportSpecifier }>();

    /**
     * Types added to this map will get a type program at the top root level of the program.
     * This is for imported types, which need to be inlined into the current file, as we do not emit type imports (TS will omit them).
     */
    protected embedDeclarations = new Map<Node, { name: EntityName, sourceFile: SourceFile, importSpecifier?: ImportSpecifier }>();

    /**
     * When a node was embedded or compiled (from the maps above), we store it here to know to not add it again.
     */
    protected compiledDeclarations = new Set<Node>();

    protected addImports: { from: Expression, identifier: Identifier }[] = [];

    protected nodeConverter: NodeConverter;
    protected typeChecker?: TypeChecker;

    constructor(
        protected context: TransformationContext,
    ) {
        this.f = context.factory;
        this.host = (context as any).getEmitHost();
        this.resolver = (context as any).getEmitResolver() as EmitResolver;
        this.nodeConverter = new NodeConverter(this.f);
    }

    protected getTypeChecker(file: SourceFile): TypeChecker {
        if ((file as any)._typeChecker) return (file as any)._typeChecker;
        const options = this.context.getCompilerOptions();
        const host = createCompilerHost(options);
        const program = createProgram([file.fileName], this.context.getCompilerOptions(), { ...this.host, ...host });
        // const program = createProgram((this.host as any).getSourceFiles().map((v: SourceFile) => v.fileName), options, { ...this.host, ...host });
        return (file as any)._typeChecker = program.getTypeChecker();
    }

    protected getTypeCheckerForHost(): TypeChecker {
        if ((this.host as any)._typeChecker) return (this.host as any)._typeChecker;
        const options = this.context.getCompilerOptions();
        const host = createCompilerHost(options);
        // const program = createProgram([this.sourceFile.fileName], this.context.getCompilerOptions(), { ...this.host, ...host });
        const program = createProgram((this.host as any).getSourceFiles().map((v: SourceFile) => v.fileName), options, { ...this.host, ...host });
        return (this.host as any)._typeChecker = program.getTypeChecker();
    }

    // protected getTypeChecker(): TypeChecker {
    //     const sourceFile: SourceFile = this.sourceFile;
    //     if ((sourceFile as any)._typeChecker) return (sourceFile as any)._typeChecker;
    //     const host = createCompilerHost(this.context.getCompilerOptions());
    //     const program = createProgram([sourceFile.fileName], this.context.getCompilerOptions(), { ...this.host, ...host });
    //     return (sourceFile as any)._typeChecker = program.getTypeChecker();
    // }

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

            if (isMethodDeclaration(node) && node.parent && isObjectLiteralExpression(node.parent)) {
                //replace MethodDeclaration with MethodExpression
                // {add(v: number) {}} => {add: function (v: number) {}}
                //so that __type can be added
                const method = this.decorateFunctionExpression(
                    this.f.createFunctionExpression(
                        node.modifiers, node.asteriskToken, isIdentifier(node.name) ? node.name : undefined,
                        node.typeParameters, node.parameters, node.type, node.body!
                    )
                );
                node = this.f.createPropertyAssignment(node.name, method);
            }

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

                let type: Declaration | undefined = undefined;
                if (isIdentifier(node.expression)) {
                    const found = this.resolveDeclaration(node.expression);
                    if (found) type = found.declaration;
                } else if (isPropertyAccessExpression(node.expression)) {
                    const found = this.getTypeCheckerForHost().getTypeAtLocation(node.expression);
                    if (found && found.symbol.declarations) type = found.symbol.declarations[0];
                }

                if (type && (isFunctionDeclaration(type) || isMethodDeclaration(type)) && type.typeParameters) {
                    const args: Expression[] = [...node.arguments];
                    let replaced = false;

                    for (let i = 0; i < type.parameters.length; i++) {
                        // for (const parameter of type.valueDeclaration.parameters) {
                        const parameter = type.parameters[i];
                        const arg = args[i];

                        //we replace from T to this arg only if either not set or set to undefined
                        if (arg && (!isIdentifier(arg) || arg.escapedText !== 'undefined')) continue;
                        if (!parameter.type) continue;

                        let hasReceiveType: TypeReferenceNode | undefined = undefined;
                        if (isTypeReferenceNode(parameter.type) && isIdentifier(parameter.type.typeName) && getIdentifierName(parameter.type.typeName) === 'ReceiveType' && parameter.type.typeArguments) {
                            //check if `fn<T>(p: ReceiveType<T>)`
                            hasReceiveType = parameter.type;
                        } else if (isUnionTypeNode(parameter.type)) {
                            //check if `fn<T>(p: Other | ReceiveType<T>)`
                            for (const member of parameter.type.types) {
                                if (isTypeReferenceNode(member) && isIdentifier(member.typeName) && getIdentifierName(member.typeName) === 'ReceiveType' && member.typeArguments) {
                                    hasReceiveType = member;
                                    break;
                                }
                            }
                        }

                        if (hasReceiveType && hasReceiveType.typeArguments) {
                            const first = hasReceiveType.typeArguments[0];
                            if (first && isTypeReferenceNode(first) && isIdentifier(first.typeName)) {
                                const name = getIdentifierName(first.typeName);
                                //find type parameter position
                                const index = type.typeParameters.findIndex(v => getIdentifierName(v.name) === name);
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
                        //make sure args has no hole
                        for (let i = 0; i < args.length; i++) {
                            if (!args[i]) args[i] = this.f.createIdentifier('undefined');
                        }
                        return this.f.updateCallExpression(node, node.expression, node.typeArguments, this.f.createNodeArray(args));
                    }
                }
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
                return [this.createProgramVarFromNode(node, d.name, d.sourceFile, d.importSpecifier), node];
            }

            return node;
        };

        while (this.compileDeclarations.size || this.embedDeclarations.size) {
            if (this.compileDeclarations.size) {
                this.sourceFile = visitNode(this.sourceFile, compileDeclarations);
            }

            if (this.embedDeclarations.size) {
                const embedded: Statement[] = [];
                for (const node of this.embedDeclarations.keys()) {
                    this.compiledDeclarations.add(node);
                }
                const entries = Array.from(this.embedDeclarations.entries());
                this.embedDeclarations.clear();
                for (const [node, d] of entries) {
                    embedded.push(this.createProgramVarFromNode(node, d.name, d.sourceFile, d.importSpecifier));
                }
                this.sourceFile = this.f.updateSourceFile(this.sourceFile, [...embedded, ...this.sourceFile.statements]);
            }
        }

        if (this.addImports.length) {
            const compilerOptions = this.context.getCompilerOptions();
            const imports: Statement[] = [];
            for (const imp of this.addImports) {
                if (compilerOptions.module === ModuleKind.CommonJS) {
                    //var {identifier} = require('./bar')
                    const variable = this.f.createVariableStatement(undefined, this.f.createVariableDeclarationList([this.f.createVariableDeclaration(
                        this.f.createObjectBindingPattern([this.f.createBindingElement(undefined, undefined, imp.identifier)]),
                        undefined, undefined,
                        this.f.createCallExpression(this.f.createIdentifier('require'), undefined, [imp.from])
                    )]));
                    imports.push(variable);
                } else {
                    //import {identifier} from './bar'
                    const specifier = this.f.createImportSpecifier(false, undefined, imp.identifier);
                    const namedImports = this.f.createNamedImports([specifier]);
                    const importStatement = this.f.createImportDeclaration(undefined, undefined,
                        this.f.createImportClause(false, undefined, namedImports), imp.from
                    );
                    imports.push(importStatement);
                }
            }

            this.sourceFile = this.f.updateSourceFile(this.sourceFile, [...imports, ...this.sourceFile.statements]);
        }

        // console.log('transform sourceFile', this.sourceFile.fileName);
        // console.log(createPrinter().printNode(EmitHint.SourceFile, this.sourceFile, this.sourceFile));
        return this.sourceFile;
    }

    protected createProgramVarFromNode(node: Node, name: EntityName, sourceFile: SourceFile, importSpecifier?: ImportSpecifier) {
        const typeProgram = new CompilerProgram(node, sourceFile);
        typeProgram.importSpecifier = importSpecifier;

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
                program.moveFrame();

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

                const config = this.findReflectionConfig(narrowed);
                if (config.mode === 'never') return;

                const name = isConstructorTypeNode(narrowed) || isConstructSignatureDeclaration(node) ? 'new' : isConstructorDeclaration(narrowed) ? 'constructor' : getPropertyName(this.f, narrowed.name);
                if (!narrowed.type && narrowed.parameters.length === 0 && !name) return;

                program.pushFrame();
                for (const parameter of narrowed.parameters) {
                    //we support at the moment only identifier as name
                    if (!isIdentifier(parameter.name)) continue;

                    const type = parameter.type ? (parameter.dotDotDotToken && isArrayTypeNode(parameter.type) ? parameter.type.elementType : parameter.type) : undefined;

                    if (type) {
                        this.extractPackStructOfType(type, program);
                    } else {
                        program.pushOp(ReflectionOp.any);
                    }

                    if (parameter.dotDotDotToken) {
                        program.pushOp(ReflectionOp.rest);
                    }

                    program.pushOp(ReflectionOp.parameter, program.findOrAddStackEntry(getNameAsString(parameter.name)));

                    if (parameter.questionToken) program.pushOp(ReflectionOp.optional);
                    if (hasModifier(parameter, SyntaxKind.PublicKeyword)) program.pushOp(ReflectionOp.public);
                    if (hasModifier(parameter, SyntaxKind.PrivateKeyword)) program.pushOp(ReflectionOp.private);
                    if (hasModifier(parameter, SyntaxKind.ProtectedKeyword)) program.pushOp(ReflectionOp.protected);
                    if (hasModifier(narrowed, SyntaxKind.ReadonlyKeyword)) program.pushOp(ReflectionOp.readonly);
                    if (parameter.initializer) {
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
            case SyntaxKind.TypeQuery: {
                //TypeScript does not narrow types down
                const narrowed = node as TypeQueryNode;

                if (program.importSpecifier) {
                    //if this is set, the current program is embedded into another file. All locally used symbols like a variable in `typeof` need to be imported
                    //in the other file as well.
                    if (isIdentifier(narrowed.exprName)) {
                        const originImportStatement = program.importSpecifier.parent.parent.parent;
                        this.addImports.push({ identifier: narrowed.exprName, from: originImportStatement.moduleSpecifier });
                    }
                }
                if (isIdentifier(narrowed.exprName)) {
                    const resolved = this.resolveDeclaration(narrowed.exprName);
                    if (resolved && findSourceFile(resolved.declaration) !== this.sourceFile) {
                        ensureImportIsEmitted(resolved.importSpecifier);
                    }
                }

                const expression = program.importSpecifier ? this.f.createIdentifier(getNameAsString(narrowed.exprName)) : serializeEntityNameAsExpression(this.f, narrowed.exprName);
                program.pushOp(ReflectionOp.typeof, program.pushStack(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, expression)));
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

    /**
     * This is a custom resolver based on populated `locals` from the binder. It uses a custom resolution algorithm since
     * we have no access to the binder/TypeChecker directly and instantiating a TypeChecker per file/transformer is incredible slow.
     */
    protected resolveDeclaration(typeName: EntityName): { declaration: Declaration, importSpecifier?: ImportSpecifier } | void {
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
            //look in globals, read through all files, see checker.ts initializeTypeChecker
            for (const file of this.host.getSourceFiles()) {
                const globals = getGlobalsOfSourceFile(file);
                if (!globals) continue;
                const symbol = globals.get(typeName.escapedText);
                if (symbol && symbol.declarations && symbol.declarations[0]) {
                    declaration = symbol.declarations[0];
                    // console.log('found global', typeName.escapedText, 'in', file.fileName);
                    break;
                }
            }
            // console.log('look in global');
        }

        let importSpecifier: ImportSpecifier | undefined = declaration && isImportSpecifier(declaration) ? declaration : undefined;

        if (declaration && isImportSpecifier(declaration)) {
            declaration = this.resolveImportSpecifier(typeName.escapedText, declaration.parent.parent.parent);
        }

        if (declaration && declaration.kind === SyntaxKind.TypeParameter && declaration.parent.kind === SyntaxKind.TypeAliasDeclaration) {
            //for alias like `type MyAlias<T> = T`, `T` is returned from `typeChecker.getDeclaredTypeOfSymbol(symbol)`.
            declaration = declaration.parent as TypeAliasDeclaration;
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

    protected getDeclarationVariableName(typeName: EntityName) {
        if (isIdentifier(typeName)) {
            return this.f.createIdentifier('__Ω' + getIdentifierName(typeName));
        }

        function joinQualifiedName(name: EntityName): string {
            if (isIdentifier(name)) return getIdentifierName(name);
            return joinQualifiedName(name.left) + '_' + getIdentifierName(name.right);
        }

        return this.f.createIdentifier('__Ω' + joinQualifiedName(typeName));
    }

    protected extractPackStructOfTypeReference(type: TypeReferenceNode | ExpressionWithTypeArguments, program: CompilerProgram): void {
        const typeName: EntityName | undefined = isTypeReferenceNode(type) ? type.typeName : (isIdentifier(type.expression) ? type.expression : undefined);
        if (!typeName) {
            program.pushOp(ReflectionOp.any);
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
                //non existing references are ignored.
                program.pushOp(ReflectionOp.never);
                return;
            }

            const declaration = resolved.declaration;

            if (isTypeAliasDeclaration(declaration) || isInterfaceDeclaration(declaration) || isEnumDeclaration(declaration)) {
                //Set/Map are interface declarations
                const name = getNameAsString(typeName);
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
                const index = program.pushStack(program.forNode === declaration ? 0 : this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, this.getDeclarationVariableName(typeName)));

                //to break recursion, we track which declaration has already been compiled
                if (!this.compiledDeclarations.has(declaration)) {
                    //imported declarations will be embedded, because we can't safely import them (we don't even know if the library has built they source with reflection on).
                    //global declarations like Partial will be embedded as well, since those are not available at runtime.
                    //when a type is embedded all its locally linked types are embedded as well. locally linked symbols like variables (for typeof calls) will
                    //be imported by modifying `resolved!.importSpecifier`, adding the symbol + making the import persistent.
                    const declarationSourceFile = findSourceFile(declaration);
                    const isGlobal = declarationSourceFile.fileName !== this.sourceFile.fileName;
                    const embed = !!(resolved!.importSpecifier || isGlobal);
                    if (embed) {
                        this.embedDeclarations.set(declaration, {
                            name: typeName,
                            sourceFile: declarationSourceFile,
                            importSpecifier: resolved!.importSpecifier || program.importSpecifier
                        });
                    } else {
                        this.compileDeclarations.set(declaration, {
                            name: typeName,
                            sourceFile: declarationSourceFile,
                            importSpecifier: resolved!.importSpecifier || program.importSpecifier
                        });
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
                ensureImportIsEmitted(resolved.importSpecifier);
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

                //check if `type` was used in an expression. if so, we need to resolve it from runtime, otherwise we mark it as T

                /**
                 * Returns the class declaration, function/arrow declaration, or block where type was used.
                 */
                function getTypeUser(type: Node): Node {
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
                function needsToBeInferred(): boolean {
                    const declarationUser = getTypeUser(declaration);
                    const typeUser = getTypeUser(type);

                    return declarationUser !== typeUser;
                }

                const isUsedInFunction = isFunctionLike(declaration.parent);
                const resolveRuntimeTypeParameter = (isUsedInFunction && program.isResolveFunctionParameters(declaration.parent)) || (needsToBeInferred());

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
            } else {
                this.extractPackStructOfType(declaration, program);
            }
        }
    }

    protected createAccessorForEntityName(e: QualifiedName): PropertyAccessExpression {
        return this.f.createPropertyAccessExpression(isIdentifier(e.left) ? e.left : this.createAccessorForEntityName(e.left), e.right);
    }

    protected findDeclarationInFile(sourceFile: SourceFile, declarationName: __String): Declaration | undefined {
        if (isNodeWithLocals(sourceFile) && sourceFile.locals) {
            const declarationSymbol = sourceFile.locals.get(declarationName);
            if (declarationSymbol && declarationSymbol.declarations && declarationSymbol.declarations[0]) {
                return declarationSymbol.declarations[0];
            }
        }
        return;
    }

    protected resolveImportSpecifier(declarationName: __String, importOrExport: ExportDeclaration | ImportDeclaration): Declaration | undefined {
        if (!importOrExport.moduleSpecifier) return;
        if (!isStringLiteral(importOrExport.moduleSpecifier)) return;

        const source = this.resolver.getExternalModuleFileFromDeclaration(importOrExport);
        if (!source) return;

        const declaration = this.findDeclarationInFile(source, declarationName);

        /**
         * declaration could also be `import {PrimaryKey} from 'xy'`, which we want to skip
         */
        if (declaration && !isImportSpecifier(declaration)) {
            //if `export {PrimaryKey} from 'xy'`, then follow xy
            if (isExportDeclaration(declaration)) {
                return this.followExport(declarationName, declaration);
            }
            return declaration;
        }

        //not found, look in exports
        for (const statement of source.statements) {
            if (!isExportDeclaration(statement)) continue;
            const found = this.followExport(declarationName, statement);
            if (found) return found;
        }

        return;
    }

    protected followExport(declarationName: __String, statement: ExportDeclaration): Declaration | undefined {
        if (statement.exportClause) {
            //export {y} from 'x'
            if (isNamedExports(statement.exportClause)) {
                for (const element of statement.exportClause.elements) {
                    //see if declarationName is exported
                    if (element.name.escapedText === declarationName) {
                        const found = this.resolveImportSpecifier(element.propertyName ? element.propertyName.escapedText : declarationName, statement);
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
                if (!reflection && getIdentifierName(tag.tagName) === 'reflection' && 'string' === typeof tag.comment) {
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

