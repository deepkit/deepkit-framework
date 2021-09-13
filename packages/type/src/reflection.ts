import {
    __String,
    ArrowFunction,
    Bundle,
    ClassDeclaration,
    ClassElement,
    CustomTransformerFactory,
    Declaration,
    ExportDeclaration,
    Expression,
    FunctionDeclaration,
    FunctionExpression,
    getJSDocTags,
    Identifier,
    ImportCall,
    ImportDeclaration,
    ImportEqualsDeclaration,
    ImportTypeNode,
    isArrayTypeNode,
    isArrowFunction,
    isClassDeclaration,
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
    isMethodDeclaration,
    isNamedExports,
    isParenthesizedTypeNode,
    isPropertyDeclaration,
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
    PropertyAssignment,
    QualifiedName,
    ScriptReferenceHost,
    SourceFile,
    Statement,
    SymbolTable,
    SyntaxKind,
    TransformationContext,
    TypeNode,
    TypeReferenceNode,
    visitEachChild,
    visitNode
} from 'typescript';
import { dirname, join, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import stripJsonComments from 'strip-json-comments';
import { ClassType, isArray } from '@deepkit/core';

/**
 * Not more than `packSize` elements are allowed (can be stored).
 */
export enum ReflectionOp {
    end, //requires to be 0. not used explicitly, but a placeholder to detect when the ops are done
    any,
    void,
    string,
    number,
    boolean,
    bigint,
    null,
    undefined,
    literal,
    function,
    property,
    method,

    //delimiter to signal the current definition is done (e.g. after an union for example, to signal the union is defined)
    //needed for genericClass and union.
    up,

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

    /**
     * Custom class references, e.g. MyClass.
     * Uses one stack entry for the class reference.
     */
    class,

    /**
     * Custom class references, with template arguments, e.g. MyClass<string>
     * Uses one stack entry for the class reference.
     */
    genericClass,
    enum,

    union,
    intersection,

    set,
    map,
    array,
    record,

    interface,

    partial,
    pick,
    exclude,

    typeAlias, //Partial, Pick, Exclude,

    keyof,

    optional,
    // public, its implicit always public if not otherwise defined
    private,
    protected,
    abstract,
    /**
     * Uses one stack entry.
     */
    defaultValue,
}

/**
 * It can't be more ops than this given number
 */
export const packSizeByte: number = 6;
export const packSize: number = 2 ** packSizeByte; //64
export const maxOpsPerPack: number = Math.floor(Math.log(Number.MAX_SAFE_INTEGER) / Math.log(packSize));

/**
 * Encoding of type information:
 *
 * Non-Op entries are entries of the stack, where the order is kept.
 *
 * string = ReflectionOp.string
 * number = ReflectionOp.number
 * boolean = ReflectionOp.boolean
 * ?: string = [ReflectionOp.string, ReflectionOp.optional]
 * string | null = [ReflectionOp.union, ReflectionOp.string, ReflectionOp.undefined]
 * ?: string | null = [ReflectionOp.union, ReflectionOp.optional, ReflectionOp.string, ReflectionOp.null]
 *
 * Config = [ReflectionOp.class, () => Config]
 *
 * Config<string> = [ReflectionOp.genericClass, () => Config, ReflectionOp.string]
 *
 * string | number = [ReflectionOp.union, ReflectionOp.string, ReflectionOp.number]
 *
 * Config<string> | string = [ReflectionOp.union, ReflectionOp.genericClass, () => Config, ReflectionOp.string, Reflection.up, ReflectionOp.string]
 *
 * action(param: string|number, size: number): void = ['param', 'size', Reflection.function, Reflection.union, Reflection.string, Reflection.number, Reflection.up, Reflection.string, Reflection.void]
 */

/**
 * Stored as:
 * (256 is `packSize`)
 * Stack entries are always at the beginning.
 *
 * string = ReflectionOp.string
 * number = ReflectionOp.number
 * boolean = ReflectionOp.boolean
 * ?string = ReflectionOp.optional*256**1 + ReflectionOp.string
 *
 * string|number = ReflectionOp.string*256**1 + ReflectionOp.number
 *
 * Config = [() => Config, ReflectionOp.class]
 *
 * ?Config = [() => Config, ReflectionOp.optional*256**1 + ReflectionOp.class]
 *
 * action(name: string): void = ReflectionOp.void*256**2 + ReflectionOp.string*256**1 + ReflectionOp.function
 *
 * action(name: string): void = ReflectionOp.void*256**2 + ReflectionOp.string*256**1 + ReflectionOp.function
 */
export function pack(packOrOps: PackStruct | ReflectionOp[]): Packed {
    const ops = isArray(packOrOps) ? packOrOps : packOrOps.ops;

    let packedOp = BigInt(0);
    for (let i = 0; i < ops.length; i++) {
        packedOp += BigInt(ops[i]) * (BigInt(packSize) ** BigInt(i));
    }

    const opNumbers = packedOp > Number.MAX_SAFE_INTEGER ? packedOp.toString(16) : Number(packedOp);

    if (!isArray(packOrOps)) {
        if (packOrOps.stack.length) {
            return [...packOrOps.stack, opNumbers];
        }
    }

    return opNumbers;
}

export type StackEntry = Expression | (() => ClassType | Object) | string | number | boolean;

export type Packed = number | string | [...StackEntry[], number | string];

function unpackOps(ops: ReflectionOp[], opsNumber: number | string): void {
    if ('string' === typeof opsNumber) {
        //the number was so big that it could not handle Number.MAX_SAFE_INTEGER, so it was stored as hex string.
        while (opsNumber) {
            unpackOps(ops, Number('0x' + opsNumber.slice(-12)));
            opsNumber = opsNumber.slice(0, -12);
        }
    } else {
        for (let i = 0; ; i++) {
            const op = (opsNumber / 2 ** (packSizeByte * i)) & (packSize - 1);
            if (op === 0) return;
            ops.push(op);
        }
    }
}

export class PackStruct {
    constructor(
        public ops: ReflectionOp[] = [],
        public stack: StackEntry[] = [],
    ) {
    }
}

export function unpack(pack: Packed): PackStruct {
    const ops: ReflectionOp[] = [];
    const stack: StackEntry[] = [];

    const opNumbers = isArray(pack) ? pack[pack.length - 1] : pack;
    if (isArray(pack)) {
        stack.push(...pack.slice(0, -1) as StackEntry[]);
    }

    unpackOps(ops, opNumbers as string | number);

    return { ops, stack };
}

/**
 * An internal helper that has not yet exposed to transformers.
 */
interface EmitResolver {
    getReferencedValueDeclaration(reference: Identifier): Declaration | undefined;

    getReferencedImportDeclaration(nodeIn: Identifier): Declaration | undefined;

    getExternalModuleFileFromDeclaration(declaration: ImportEqualsDeclaration | ImportDeclaration | ExportDeclaration | ModuleDeclaration | ImportTypeNode | ImportCall): SourceFile | undefined;
}

const reflectionModes = ['always', 'default', 'never'] as const;


function isNodeWithLocals(node: Node): node is (Node & { locals: SymbolTable | undefined }) {
    return 'locals' in node;
}

/**
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

    withReflectionMode(mode: typeof reflectionModes[number]): this {
        this.reflectionMode = mode;
        return this;
    }

    transformBundle(node: Bundle): Bundle {
        return node;
    }

    transformSourceFile(sourceFile: SourceFile): SourceFile {
        this.sourceFile = sourceFile;

        const visitor = (node: Node): any => {
            node = visitEachChild(node, visitor, this.context);

            if (isClassDeclaration(node)) {
                return this.decorateClass(node);
            } else if (isFunctionExpression(node)) {
                return this.decorateFunctionExpression(node);
            } else if (isFunctionDeclaration(node)) {
                return this.decorateFunctionDeclaration(node);
            } else if (isArrowFunction(node)) {
                return this.decorateArrow(node);
            }
            // if (isFunctionDeclaration(node)) {
            //     return this.decorateFunctionDeclaration(node);
            // }

            return node;
            // return visitEachChild(node, visitor, this.context);
        };

        this.sourceFile = visitNode(sourceFile, visitor);

        return this.sourceFile;
    }

    protected extractPackStructOfType(node: TypeNode | Declaration, ops: ReflectionOp[], stack: StackEntry[], modifier: () => void = () => {}): void {
        if (isParenthesizedTypeNode(node)) return this.extractPackStructOfType(node.type, ops, stack, modifier);

        const reflection = this.findReflectionConfig(node);
        if (reflection.mode === 'never') return;

        if (node.kind === SyntaxKind.StringKeyword) {
            ops.push(ReflectionOp.string);
            modifier();
        } else if (node.kind === SyntaxKind.NumberKeyword) {
            ops.push(ReflectionOp.number);
            modifier();
        } else if (node.kind === SyntaxKind.BooleanKeyword) {
            ops.push(ReflectionOp.boolean);
            modifier();
        } else if (node.kind === SyntaxKind.BigIntKeyword) {
            ops.push(ReflectionOp.bigint);
            modifier();
        } else if (node.kind === SyntaxKind.VoidKeyword) {
            ops.push(ReflectionOp.void);
            modifier();
        } else if (node.kind === SyntaxKind.NullKeyword) {
            ops.push(ReflectionOp.null);
            modifier();
        } else if (node.kind === SyntaxKind.UndefinedKeyword) {
            ops.push(ReflectionOp.undefined);
            modifier();
        } else if (isTypeLiteralNode(node)) {
            //{[name: string]: number} => t.record(t.string, t.number)
            const [first] = node.members;
            //has always two sub types
            ops.push(ReflectionOp.record);
            modifier();
            if (first && isIndexSignatureDeclaration(first) && first.parameters[0] && first.parameters[0].type) {
                this.extractPackStructOfType(first.parameters[0].type, ops, stack);
                this.extractPackStructOfType(first.type, ops, stack);
            } else {
                ops.push(ReflectionOp.any);
                ops.push(ReflectionOp.any);
            }
        } else if (isTypeReferenceNode(node) && isIdentifier(node.typeName) && node.typeName.escapedText === 'Record' && node.typeArguments && node.typeArguments.length === 2) {
            //Record<string, number> => t.record(t.string, t.number)
            const [key, value] = node.typeArguments;
            ops.push(ReflectionOp.record);
            modifier();
            this.extractPackStructOfType(key, ops, stack);
            this.extractPackStructOfType(value, ops, stack);

        } else if (isTypeReferenceNode(node)) {
            this.extractPackStructOfTypeReference(node, ops, stack, modifier);
        } else if (isArrayTypeNode(node)) {
            ops.push(ReflectionOp.array);
            modifier();
            this.extractPackStructOfType(node.elementType, ops, stack);
        } else if (isPropertyDeclaration(node) && node.type) {
            this.extractPackStructOfType(node.type, ops, stack, () => {
                if (node.questionToken) ops.push(ReflectionOp.optional);
            });
        } else if (isMethodDeclaration(node) || isConstructorDeclaration(node) || isArrowFunction(node) || isFunctionExpression(node) || isFunctionDeclaration(node)) {
            if (node.parameters.length === 0 && !node.type) return;
            ops.push(ReflectionOp.function);
            modifier();
            for (const parameter of node.parameters) {
                if (parameter.type) {
                    this.extractPackStructOfType(parameter.type, ops, stack);
                }
            }

            if (node.type) {
                this.extractPackStructOfType(node.type, ops, stack);
            } else {
                ops.push(ReflectionOp.any);
            }
            ops.push(ReflectionOp.up);
        } else if (isLiteralTypeNode(node)) {
            if (node.literal.kind === SyntaxKind.NullKeyword) {
                ops.push(ReflectionOp.null);
                modifier();
            } else {
                ops.push(ReflectionOp.literal);
                modifier();
                stack.push(node.literal);
            }
        } else if (isUnionTypeNode(node)) {
            ops.push(ReflectionOp.union);
            modifier();
            for (const subType of node.types) {
                this.extractPackStructOfType(subType, ops, stack);
            }
            ops.push(ReflectionOp.up);
        } else {
            ops.push(ReflectionOp.any);
            modifier();
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

    protected extractPackStructOfTypeReference(type: TypeReferenceNode, ops: ReflectionOp[], stack: StackEntry[], modifier: () => void) {
        if (isIdentifier(type.typeName) && this.knownClasses[type.typeName.escapedText as string]) {
            ops.push(this.knownClasses[type.typeName.escapedText as string]);
            modifier();
        } else if (isIdentifier(type.typeName) && type.typeName.escapedText === 'Promise') {
            ops.push(ReflectionOp.promise);
            modifier();
            //promise has always one sub type
            if (type.typeArguments && type.typeArguments[0]) {
                this.extractPackStructOfType(type.typeArguments[0], ops, stack);
            } else {
                ops.push(ReflectionOp.any);
            }
        } else {
            let declaration: Node | undefined = isIdentifier(type.typeName) ? this.resolver.getReferencedValueDeclaration(type.typeName) : undefined;
            if (!declaration && isIdentifier(type.typeName)) {
                declaration = this.findDeclarationInFile(this.sourceFile, type.typeName.escapedText as string);
                if (declaration && isImportSpecifier(declaration)) declaration = undefined;
            }

            if (isIdentifier(type.typeName)) {
                const referencedImport = this.resolver.getReferencedImportDeclaration(type.typeName);
                if (referencedImport && isImportSpecifier(referencedImport)) {
                    if (!declaration) {
                        declaration = this.resolveImportSpecifier(type.typeName.escapedText as string, referencedImport.parent.parent.parent);
                    }

                    //for imports that can removed (like a class import used only used as type only, like `p: Model[]`) we have
                    //to modify the import so TS does not remove it
                    if (declaration && (!isInterfaceDeclaration(declaration) && !isTypeAliasDeclaration(declaration))) {
                        //make synthetic. Let the TS compiler keep this import
                        (referencedImport as any).flags |= NodeFlags.Synthesized;
                    }
                }
            }

            if (!declaration) {
                //non existing references are ignored.
                //todo: we could search in the generics of type.parent is a ClassDeclaration.
                //console.log('No type reference found for', this.sourceFile.fileName.slice(-128), type.parent.getText(), isIdentifier(type.typeName) ? type.typeName.escapedText : this.createAccessorForEntityName(type.typeName));
                ops.push(ReflectionOp.any);
                modifier();
                return;
            }

            if (isInterfaceDeclaration(declaration)) {
                ops.push(ReflectionOp.interface);
                modifier();
                return;
            } else if (isTypeAliasDeclaration(declaration)) {
                ops.push(ReflectionOp.typeAlias);
                modifier();
                return;
            } else if (isEnumDeclaration(declaration)) {
                ops.push(ReflectionOp.enum);
                modifier();
                stack.push(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName)));
                return;
            } else {
                ops.push(type.typeArguments ? ReflectionOp.genericClass : ReflectionOp.class);
                modifier();
                stack.push(this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName)));

                if (type.typeArguments) {
                    for (const template of type.typeArguments) {
                        this.extractPackStructOfType(template, ops, stack);
                    }
                    ops.push(ReflectionOp.up);
                }
            }
        }
    }

    createAccessorForEntityName(e: QualifiedName): PropertyAccessExpression {
        return this.f.createPropertyAccessExpression(
            isIdentifier(e.left) ? e.left : this.createAccessorForEntityName(e.left),
            e.right,
        );
    }

    findDeclarationInFile(sourceFile: SourceFile, declarationName: string): Declaration | undefined {
        if (isNodeWithLocals(sourceFile) && sourceFile.locals) {
            const declarationSymbol = sourceFile.locals.get(declarationName as __String);
            if (declarationSymbol && declarationSymbol.declarations && declarationSymbol.declarations[0]) {
                return declarationSymbol.declarations[0];
            }
        }
        return;
    }

    resolveImportSpecifier(declarationName: string, importOrExport: ExportDeclaration | ImportDeclaration): Node | undefined {
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
        const packStruct = new PackStruct;
        this.extractPackStructOfType(type, packStruct.ops, packStruct.stack);
        return this.packOpsAndStack(packStruct);
    }

    protected packOpsAndStack(packStruct: PackStruct) {
        if (packStruct.ops.length === 0) return;
        if (packStruct.ops[packStruct.ops.length - 1] === ReflectionOp.up) {
            packStruct.ops.pop(); //last break can be removed
        }
        const packed = pack(packStruct);
        // console.log('packed', packStruct.ops.map(v => ReflectionOp[v]));
        return this.valueToExpression(packed);
    }

    protected valueToExpression(value: any): Expression {
        if (isArray(value)) return this.f.createArrayLiteralExpression(value.map(v => this.valueToExpression(v)));
        if ('string' === typeof value) return this.f.createStringLiteral(value);
        if ('number' === typeof value) return this.f.createNumericLiteral(value);

        return value;
    }

    /**
     * A class is decorated with type information by adding a static variable.
     *
     * class Model {
     *     static __types = {title: pack(ReflectionOp.string)}; //<-- encoded type information
     *     title: string;
     * }
     */
    protected decorateClass(classDeclaration: ClassDeclaration): ClassDeclaration {
        const elements: PropertyAssignment[] = [];

        for (const property of classDeclaration.members) {
            const name = property.name ? property.name : isConstructorDeclaration(property) ? 'constructor' : '';
            if (!name) continue;

            //already decorated
            if ('string' === typeof name ? false : isIdentifier(name) ? name.text === '__type' : false) {
                return classDeclaration;
            }

            const encodedType = this.getTypeOfType(property);
            if (!encodedType) continue;
            elements.push(this.f.createPropertyAssignment(name, encodedType));
        }

        if (elements.length === 0) return classDeclaration;

        const types = this.f.createObjectLiteralExpression(elements);
        const __type = this.f.createPropertyDeclaration(undefined, this.f.createModifiersFromModifierFlags(ModifierFlags.Static), '__type', undefined, undefined, types);

        return this.f.updateClassDeclaration(classDeclaration, classDeclaration.decorators, classDeclaration.modifiers,
            classDeclaration.name, classDeclaration.typeParameters, classDeclaration.heritageClauses,
            this.f.createNodeArray<ClassElement>([...classDeclaration.members, __type])
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
                    return {mode: this.parseReflectionMode(tag.comment as any || true)};
                }
            }
            current = current.parent;
        } while (current);

        //nothing found, look in tsconfig.json
        if (this.reflectionMode) return { mode: this.reflectionMode };
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

                    if (!reflection && tsConfig.reflection !== undefined) {
                        return {mode: this.parseReflectionMode(tsConfig.reflection)};
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
