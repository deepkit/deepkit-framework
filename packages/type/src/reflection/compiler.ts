/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    __String,
    ArrowFunction,
    Bundle,
    ClassDeclaration,
    ClassElement,
    ClassExpression,
    createCompilerHost,
    createProgram,
    CustomTransformerFactory,
    Declaration,
    ExportDeclaration,
    Expression,
    FunctionDeclaration,
    FunctionExpression,
    getJSDocTags,
    ImportCall,
    ImportDeclaration,
    ImportEqualsDeclaration,
    ImportSpecifier,
    ImportTypeNode,
    InterfaceDeclaration,
    isArrayTypeNode,
    isArrowFunction,
    isCallExpression,
    isClassDeclaration,
    isClassExpression,
    isConditionalTypeNode,
    isConstructorDeclaration,
    isEnumDeclaration,
    isExportDeclaration,
    isFunctionDeclaration,
    isFunctionExpression,
    isIdentifier,
    isImportSpecifier,
    isIndexSignatureDeclaration,
    isInterfaceDeclaration,
    isLiteralTypeNode,
    isMappedTypeNode,
    isMethodDeclaration,
    isNamedExports,
    isParenthesizedTypeNode,
    isPropertyDeclaration,
    isPropertySignature,
    isStringLiteral,
    isTypeAliasDeclaration,
    isTypeLiteralNode,
    isTypeReferenceNode,
    isUnionTypeNode,
    ModifierFlags,
    ModuleDeclaration,
    Node,
    NodeFactory,
    NodeFlags,
    PropertyAccessExpression,
    QualifiedName,
    ScriptReferenceHost,
    SourceFile,
    Statement,
    SymbolTable,
    SyntaxKind,
    TransformationContext,
    TypeChecker,
    TypeElement,
    TypeLiteralNode,
    TypeNode,
    TypeReferenceNode,
    visitEachChild,
    visitNode
} from 'typescript';
import { ClassType, isArray } from '@deepkit/core';
import { getNameAsString, hasModifier } from './reflection-ast';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import stripJsonComments from 'strip-json-comments';
import { Type } from './type';

/**
 * The instruction set.
 * Not more than `packSize` elements are allowed (can be stored).
 */
export enum ReflectionOp {
    never,
    any,
    void,

    string,
    number,
    boolean,
    bigint,

    null,
    undefined,

    /**
     * The literal type of string, number, or boolean.
     *
     * This OP has 1 parameter. The next byte is the absolute address of the literal on the stack, which is the actual literal value.
     *
     * Pushes a function type.
     */
    literal,

    /**
     * This OP pops all types on the current stack frame.
     *
     * This OP has 1 parameter. The next byte is the absolute address of a string|number|symbol entry on the stack.
     *
     * Pushes a function type.
     */
    function,

    /**
     * This OP pops all types on the current stack frame.
     *
     * Pushes a method type.
     */
    method,
    methodSignature, //has 1 parameter, reference to stack for its property name

    /**
     * This OP pops the latest type entry on the stack.
     *
     * Pushes a property type.
     */
    property,
    propertySignature, //has 1 parameter, reference to stack for its property name

    constructor,

    /**
     * This OP pops all types on the current stack frame. Those types should be method|property.
     *
     * Pushes a class type.
     */
    class,

    /**
     * This OP has 1 parameter, the stack entry to the actual class symbol.
     */
    classReference,

    /**
     * Marks the last entry in the stack as optional. Used for method|property. Equal to the QuestionMark operator in a property assignment.
     */
    optional,

    //modifiers for property|method
    private,
    protected,
    abstract,

    /**
     * This OP has 1 parameter. The next byte is the absolute address of a enum entry on the stack.
     */
    enum,

    set,
    map,

    /**
     * This OP pops all members on the stack frame and pushes a new enum type.
     */
    constEnum,

    /**
     * Pops the latest stack entry and uses it as T for an array type.
     *
     * Pushes an array type.
     */
    array,

    union, //pops frame. requires frame start when stack can be dirty.
    intersection,

    indexSignature,
    objectLiteral,
    mappedType,
    in,

    frame, //creates a new stack frame
    return,

    //special instructions that exist to emit less output
    date,
    int8Array,
    uint8ClampedArray,
    uint8Array,
    int16Array,
    uint16Array,
    int32Array,
    uint32Array,
    float32Array,
    float64Array,
    bigInt64Array,
    arrayBuffer,
    promise,

    pointer, //parameter is a number referencing an entry in the stack, relative to the very beginning (0). pushes that entry onto the stack.
    arg, //@deprecated. parameter is a number referencing an entry in the stack, relative to the beginning of the current frame, *-1. pushes that entry onto the stack. this is related to the calling convention.
    template, //template argument, e.g. T in a generic. has 1 parameter: reference to the name.
    var, //reserve a new variable in the stack
    loads, //pushes to the stack a referenced value in the stack. has 2 parameters: <frame> <index>, frame is a negative offset to the frame, and index the index of the stack entry withing the referenced frame

    query, //T['string'], 2 items on the stack
    keyof, //keyof operator
    infer, //2 params, like `loads`

    condition,
    jump, //jump to an address
    call, //has one parameter, the next program address. creates a new stack frame with current program address as first stack entry, and jumps back to that + 1.
    jumpCondition,
    extends, //X extends Y, XY popped from the stack, pushes boolean on the stack
}

export const packSizeByte: number = 6;

/**
 * It can't be more ops than this given number
 */
export const packSize: number = 2 ** packSizeByte; //64

export type StackEntry = Expression | (() => ClassType | Object) | string | number | boolean;
export type RuntimeStackEntry = Type | Object | (() => ClassType | Object) | string | number | boolean;

export type Packed = string | (StackEntry | string)[];

function unpackOps(decodedOps: ReflectionOp[], encodedOPs: string): void {
    for (let i = 0; i < encodedOPs.length; i++) {
        decodedOps.push(encodedOPs.charCodeAt(i) - 33);
    }
}

export class PackStruct {
    constructor(
        public ops: ReflectionOp[] = [],
        public stack: StackEntry[] = [],
    ) {
    }
}

/**
 * Pack a pack structure (op instructions + pre-defined stack) and create a encoded version of it.
 */
export function pack(packOrOps: PackStruct | ReflectionOp[]): Packed {
    const ops = isArray(packOrOps) ? packOrOps : packOrOps.ops;
    const encodedOps = ops.map(v => String.fromCharCode(v + 33)).join('');

    if (!isArray(packOrOps)) {
        if (packOrOps.stack.length) {
            return [...packOrOps.stack as StackEntry[], encodedOps];
        }
    }

    return encodedOps;
}

export function unpack(pack: Packed): PackStruct {
    const ops: ReflectionOp[] = [];
    const stack: StackEntry[] = [];

    if ('string' === typeof pack) {
        unpackOps(ops, pack);
        return { ops, stack };
    }

    const encodedOPs = pack[pack.length - 1];

    //the end has always to be a string
    if ('string' !== typeof encodedOPs) return { ops: [], stack: [] };

    if (pack.length > 1) {
        stack.push(...pack.slice(0, -1) as StackEntry[]);
    }

    unpackOps(ops, encodedOPs);

    return { ops, stack };
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

/**
 * Returns the index of the `entry` in the stack, if already exists. If not, add it, and return that new index.
 */
function findOrAddStackEntry(program: CompilerProgram, entry: any): number {
    const index = program.stack.indexOf(entry);
    if (index !== -1) return index;
    return program.pushStack(entry);
}

const OPs: { [op in ReflectionOp]?: { params: number } } = {
    [ReflectionOp.literal]: { params: 1 },
    [ReflectionOp.pointer]: { params: 1 },
    [ReflectionOp.arg]: { params: 1 },
    [ReflectionOp.classReference]: { params: 1 },
    [ReflectionOp.propertySignature]: { params: 1 },
    [ReflectionOp.property]: { params: 1 },
    [ReflectionOp.enum]: { params: 1 },
    [ReflectionOp.template]: { params: 1 },
};

export function debugPackStruct(pack: PackStruct): void {
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

function isNodeWithLocals(node: Node): node is (Node & { locals: SymbolTable | undefined }) {
    return 'locals' in node;
}

interface Frame {
    variables: { name: string, index: number }[],
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

class CompilerProgram {
    ops: ReflectionOp[] = [];
    stack: StackEntry[] = [];

    stackPosition: number = 0;

    frame: Frame = { variables: [] };

    pushStack(item: StackEntry): number {
        this.stack.push(item);
        return this.stackPosition++;
    }

    /**
     * To make room for a stack entry expected on the stack as input for example.
     */
    increaseStackPosition(): number {
        return this.stackPosition++;
    }

    pushFrame() {
        this.ops.push(ReflectionOp.frame);
        this.frame = { previous: this.frame, variables: [] };
    }

    popFrame() {
        if (this.frame.previous) this.frame = this.frame.previous;
    }

    pushVariable(name: string): void {
        this.frame.variables.push({
            index: this.frame.variables.length,
            name,
        });
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
                if (isIdentifier(node.expression) && autoTypeFunctions.includes(node.expression.escapedText as string)) {
                    const args: Expression[] = [...node.arguments];

                    if (!args.length) {
                        args.push(this.f.createArrayLiteralExpression());
                    }

                    const type = this.getTypeOfType(node.typeArguments[0]);
                    if (!type) return node;
                    args.push(type);

                    return this.f.updateCallExpression(node, node.expression, node.typeArguments, this.f.createNodeArray(args))
                }
                return node;
            }

            return node;
        };

        this.sourceFile = visitNode(sourceFile, visitor);

        return this.sourceFile;
    }

    protected extractPackStructOfType(node: TypeNode | Declaration, program: CompilerProgram): void {
        if (isParenthesizedTypeNode(node)) return this.extractPackStructOfType(node.type, program);

        if (node.kind === SyntaxKind.StringKeyword) {
            program.ops.push(ReflectionOp.string);
        } else if (node.kind === SyntaxKind.NumberKeyword) {
            program.ops.push(ReflectionOp.number);
        } else if (node.kind === SyntaxKind.BooleanKeyword) {
            program.ops.push(ReflectionOp.boolean);
        } else if (node.kind === SyntaxKind.BigIntKeyword) {
            program.ops.push(ReflectionOp.bigint);
        } else if (node.kind === SyntaxKind.VoidKeyword) {
            program.ops.push(ReflectionOp.void);
        } else if (node.kind === SyntaxKind.NullKeyword) {
            program.ops.push(ReflectionOp.null);
        } else if (node.kind === SyntaxKind.NeverKeyword) {
            program.ops.push(ReflectionOp.never);
        } else if (node.kind === SyntaxKind.UndefinedKeyword) {
            program.ops.push(ReflectionOp.undefined);
        } else if (isClassDeclaration(node) || isClassExpression(node)) {
            const members: ClassElement[] = [];
            if (node.typeParameters) {
                if (program.ops.length) program.pushFrame();

                for (const typeParameter of node.typeParameters) {
                    const name = getNameAsString(typeParameter.name);
                    program.pushVariable(name);
                    program.ops.push(ReflectionOp.template, findOrAddStackEntry(program, name));
                }
            }

            for (const member of node.members) {
                const name = getNameAsString(member.name);
                if (name) {
                    const has = members.some(v => getNameAsString(v.name) === name);
                    if (has) continue;
                }
                members.push(member);

                this.extractPackStructOfType(member, program);
            }

            program.ops.push(ReflectionOp.class);
            if (program.ops.length) program.popFrame();

            return;
        } else if (isMappedTypeNode(node)) {
            //<Type>{[Property in keyof Type]: boolean;};
            //todo: how do we serialize that? We need to calculate the actual type and serialize that as ObjectLiteral
            program.ops.push(ReflectionOp.mappedType);
        } else if (isInterfaceDeclaration(node) || isTypeLiteralNode(node)) {
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

            extractMembers(node);

            // program.ops.push(isInterfaceDeclaration(node) ? ReflectionOp.interface : ReflectionOp.objectLiteral);
            program.ops.push(ReflectionOp.objectLiteral);
            return;
        } else if (isTypeReferenceNode(node)) {
            this.extractPackStructOfTypeReference(node, program);
        } else if (isArrayTypeNode(node)) {
            this.extractPackStructOfType(node.elementType, program);
            program.ops.push(ReflectionOp.array);
        } else if (isPropertySignature(node) && node.type) {
            this.extractPackStructOfType(node.type, program);
            const name = getNameAsString(node.name);
            program.ops.push(ReflectionOp.propertySignature, findOrAddStackEntry(program, name));

            // } else if (isConstructorDeclaration(node) && node.type) {
            //     this.extractPackStructOfType(node.type, program);
            //     program.ops.push(ReflectionOp.constructor);

        } else if (isConditionalTypeNode(node)) {
            this.extractPackStructOfType(node.checkType, program);
            this.extractPackStructOfType(node.extendsType, program);
            program.ops.push(ReflectionOp.extends);
            this.extractPackStructOfType(node.trueType, program);
            this.extractPackStructOfType(node.falseType, program);
            program.ops.push(ReflectionOp.condition);
        } else if (isPropertyDeclaration(node) && node.type) {
            const config = this.findReflectionConfig(node);
            if (config.mode === 'never') return;

            this.extractPackStructOfType(node.type, program);
            const name = getNameAsString(node.name);
            program.ops.push(ReflectionOp.property, findOrAddStackEntry(program, name));

            if (node.questionToken) program.ops.push(ReflectionOp.optional);
            if (hasModifier(node, SyntaxKind.PrivateKeyword)) program.ops.push(ReflectionOp.private);
            if (hasModifier(node, SyntaxKind.ProtectedKeyword)) program.ops.push(ReflectionOp.protected);
            if (hasModifier(node, SyntaxKind.AbstractKeyword)) program.ops.push(ReflectionOp.abstract);

        } else if (isMethodDeclaration(node) || isConstructorDeclaration(node) || isArrowFunction(node) || isFunctionExpression(node) || isFunctionDeclaration(node)) {
            const config = this.findReflectionConfig(node);
            if (config.mode === 'never') return;

            if (node.parameters.length === 0 && !node.type) return;
            for (const parameter of node.parameters) {
                if (parameter.type) {
                    this.extractPackStructOfType(parameter.type, program);
                }
            }

            if (node.type) {
                this.extractPackStructOfType(node.type, program);
            } else {
                program.ops.push(ReflectionOp.any);
            }

            const name = isConstructorDeclaration(node) ? 'constructor' : getNameAsString(node.name);
            program.ops.push(isMethodDeclaration(node) || isConstructorDeclaration(node) ? ReflectionOp.method : ReflectionOp.function, findOrAddStackEntry(program, name));

            if (isMethodDeclaration(node)) {
                if (hasModifier(node, SyntaxKind.PrivateKeyword)) program.ops.push(ReflectionOp.private);
                if (hasModifier(node, SyntaxKind.ProtectedKeyword)) program.ops.push(ReflectionOp.protected);
                if (hasModifier(node, SyntaxKind.AbstractKeyword)) program.ops.push(ReflectionOp.abstract);
            }
        } else if (isLiteralTypeNode(node)) {
            if (node.literal.kind === SyntaxKind.NullKeyword) {
                program.ops.push(ReflectionOp.null);
            } else {
                program.ops.push(ReflectionOp.literal, findOrAddStackEntry(program, node.literal));
            }
        } else if (isUnionTypeNode(node)) {
            if (node.types.length === 0) {
                //nothing to emit
                return;
            } else if (node.types.length === 1) {
                //only emit the type
                this.extractPackStructOfType(node.types[0], program);
            } else {
                if (program.ops.length) program.pushFrame();

                for (const subType of node.types) {
                    this.extractPackStructOfType(subType, program);
                }

                program.ops.push(ReflectionOp.union);
                if (program.ops.length) program.popFrame();
            }
        } else if (isIndexSignatureDeclaration(node)) {
            //node.parameters = first item is {[name: string]: number} => 'name: string'
            if (node.parameters[0].type) {
                this.extractPackStructOfType(node.parameters[0].type, program);
            } else {
                program.ops.push(ReflectionOp.any);
            }

            //node.type = first item is {[name: string]: number} => 'number'
            this.extractPackStructOfType(node.type, program);
            program.ops.push(ReflectionOp.indexSignature);
        } else {
            program.ops.push(ReflectionOp.any);
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
        if (!isIdentifier(e)) return;

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
                declaration = this.resolveImportSpecifier('Message', declaration.parent.parent.parent);
            }
        }

        if (!declaration) return;

        return { declaration, importSpecifier };
    }

    protected extractPackStructOfTypeReference(type: TypeReferenceNode, program: CompilerProgram) {
        if (isIdentifier(type.typeName) && this.knownClasses[type.typeName.escapedText as string]) {
            program.ops.push(this.knownClasses[type.typeName.escapedText as string]);
        } else if (isIdentifier(type.typeName) && type.typeName.escapedText === 'Promise') {
            //promise has always one sub type
            if (type.typeArguments && type.typeArguments[0]) {
                this.extractPackStructOfType(type.typeArguments[0], program);
            } else {
                program.ops.push(ReflectionOp.any);
            }
            program.ops.push(ReflectionOp.promise);
        } else {
            //check if it references a variable
            if (isIdentifier(type.typeName)) {
                const variable = program.findVariable(type.typeName.escapedText as string);
                if (variable) {
                    program.ops.push(ReflectionOp.loads, variable.frameOffset, variable.stackIndex);
                    return;
                }
            }

            const resolved = this.resolveDeclaration(type.typeName);
            if (!resolved) {
                //we don't resolve yet global identifiers as it's not clear how to resolve them efficiently.
                if (isIdentifier(type.typeName)) {
                    if (type.typeName.escapedText === 'Partial') {
                        //type Partial<T> = {
                        //    [P in keyof T]?: T[P]
                        //};
                        //type Partial<T> = {
                        //    [P in keyof T]?: {[index: string]: T}
                        //};
                        //type Partial<T extends string> = {
                        //    [P in T]: number
                        //};
                    }
                }

                //non existing references are ignored.
                program.ops.push(ReflectionOp.any);
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

            if (isTypeAliasDeclaration(declaration)) {
                //type X = y;
                //we just use the actual value and remove the fact that it came from an alias.
                this.extractPackStructOfType(declaration.type, program);
            } else if (isMappedTypeNode(declaration)) {
                //<Type>{[Property in keyof Type]: boolean;};
                this.extractPackStructOfType(declaration, program);
                return;
            } else if (isEnumDeclaration(declaration)) {
                ensureImportIsEmitted();
                //enum X {}
                const arrow = this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName));
                program.ops.push(ReflectionOp.enum, findOrAddStackEntry(program, arrow));
                return;
            } else if (isClassDeclaration(declaration)) {
                ensureImportIsEmitted();
                // program.ops.push(type.typeArguments ? ReflectionOp.genericClass : ReflectionOp.class);
                //
                // //todo: this needs a better logic to also resolve references that are not yet imported.
                // // this can happen when a type alias is imported which itself references to a type from another import.

                if (type.typeArguments) {
                    for (const template of type.typeArguments) {
                        this.extractPackStructOfType(template, program);
                    }
                }

                const index = program.pushStack(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName)));
                program.ops.push(ReflectionOp.classReference);
                program.ops.push(index);
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
                        if (element.name.escapedText === declarationName) {
                            const found = this.resolveImportSpecifier(element.propertyName ? element.propertyName.escapedText as string : declarationName, statement);
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

    protected getTypeOfType(type: TypeNode | Declaration): Expression | undefined {
        const reflection = this.findReflectionConfig(type);
        if (reflection.mode === 'never') return;

        const program = new CompilerProgram();
        this.extractPackStructOfType(type, program);
        return this.packOpsAndStack({ ops: program.ops, stack: program.stack });
    }

    protected packOpsAndStack(packStruct: PackStruct) {
        if (packStruct.ops.length === 0) return;
        const packed = pack(packStruct);
        // debugPackStruct(packStruct);
        return this.valueToExpression(packed);
    }

    protected valueToExpression(value: any): Expression {
        if (isArray(value)) return this.f.createArrayLiteralExpression(value.map(v => this.valueToExpression(v)));
        if ('string' === typeof value) return this.f.createStringLiteral(value, true);
        if ('number' === typeof value) return this.f.createNumericLiteral(value);

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

    protected resolvedTsConfig: { [path: string]: Record<string, any> } = {};

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
            const exists = existsSync(join(currentDir, 'tsconfig.json'));
            if (exists) {
                const tsconfigPath = join(currentDir, 'tsconfig.json');
                try {
                    let tsConfig: Record<string, any> = {};
                    if (this.resolvedTsConfig[tsconfigPath]) {
                        tsConfig = this.resolvedTsConfig[tsconfigPath];
                    } else {
                        let content = readFileSync(tsconfigPath, 'utf8');
                        content = stripJsonComments(content);
                        tsConfig = JSON.parse(content);
                    }

                    if (reflection === undefined && tsConfig.reflection !== undefined) {
                        return { mode: this.parseReflectionMode(tsConfig.reflection) };
                    }
                } catch (error: any) {
                    console.warn(`Could not parse ${tsconfigPath}: ${error}`);
                }
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
