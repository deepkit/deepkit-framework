import {
    __String,
    Bundle,
    CustomTransformerFactory,
    Declaration,
    Decorator,
    ExportDeclaration,
    Expression,
    getJSDocTags,
    Identifier,
    ImportCall,
    ImportDeclaration,
    ImportEqualsDeclaration,
    ImportTypeNode,
    isArrayTypeNode,
    isCallExpression,
    isConstructorDeclaration,
    isEnumDeclaration,
    isExportDeclaration,
    isIdentifier,
    isImportDeclaration,
    isImportSpecifier,
    isIndexSignatureDeclaration,
    isInterfaceDeclaration,
    isLiteralTypeNode,
    isMethodDeclaration,
    isNamedExports,
    isNamedImports,
    isParameter,
    isParenthesizedExpression,
    isParenthesizedTypeNode,
    isPrivateIdentifier,
    isPropertyAccessExpression,
    isPropertyDeclaration,
    isQualifiedName,
    isStringLiteral,
    isTypeAliasDeclaration,
    isTypeLiteralNode,
    isTypeQueryNode,
    isTypeReferenceNode,
    isUnionTypeNode,
    MethodDeclaration,
    ModuleDeclaration,
    Node,
    NodeArray,
    NodeFactory,
    NodeFlags,
    ParameterDeclaration,
    PropertyAccessExpression,
    PropertyDeclaration,
    QualifiedName,
    ScriptReferenceHost,
    SourceFile,
    Symbol,
    SymbolTable,
    SyntaxKind,
    TransformationContext,
    TypeNode,
    visitEachChild,
    visitNode
} from 'typescript';
import { Types } from './types';
import { dirname, join, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import stripJsonComments from 'strip-json-comments';

const reflectionModes = ['always', 'default', 'never'] as const;

/**
 * An internal helper that has not yet exposed to transformers.
 */
interface EmitResolver {
    getReferencedValueDeclaration(reference: Identifier): Declaration | undefined;

    getReferencedImportDeclaration(nodeIn: Identifier): Declaration | undefined;

    getExternalModuleFileFromDeclaration(declaration: ImportEqualsDeclaration | ImportDeclaration | ExportDeclaration | ModuleDeclaration | ImportTypeNode | ImportCall): SourceFile | undefined;
}

export class DeepkitTransformer {
    protected host!: ScriptReferenceHost;
    protected resolver!: EmitResolver;
    protected f: NodeFactory;

    sourceFile!: SourceFile;

    constructor(
        protected context: TransformationContext,
    ) {
        this.f = context.factory;
        this.host = (context as any).getEmitHost() as ScriptReferenceHost;
        this.resolver = (context as any).getEmitResolver() as EmitResolver;
    }

    protected findTFromImports(t: string = 't', moduleName: string = '@deepkit/type') {
        for (const statement of this.sourceFile.statements) {
            if (isImportDeclaration(statement) && statement.importClause) {
                if (isStringLiteral(statement.moduleSpecifier) && (!moduleName || statement.moduleSpecifier.text === moduleName)) {
                    if (statement.importClause.namedBindings && isNamedImports(statement.importClause.namedBindings)) {
                        for (const element of statement.importClause.namedBindings.elements) {
                            if (element.name.text === t) {
                                return element.name;
                            }
                        }
                    }
                }
            }
        }
        return;
    }

    findOrCreateImportT(module: string): Identifier {
        const t = this.findTFromImports('t', module);
        if (t) return t;

        {
            const t = this.f.createIdentifier('t'); //Identifier = 78
            const is = this.f.createImportSpecifier(undefined, t); //ImportSpecifier = 266, has symbol, with itself
            (t as any).parent = is;
            //this binds the `t` to the actual import. This is important when another transformer transforms the imports (like for commonjs)
            //so that this transformer is renamed as well.
            //See the internal Type of ts.Identifier for more information.
            (t as any).generatedImportReference = is;

            //NamedImports = 265, no symbol
            const ni = this.f.createNamedImports([is]);
            (is as any).parent = ni;

            //ImportClause=263
            const ic = this.f.createImportClause(false, undefined, ni);
            (ni as any).parent = ic;

            //ImportDeclaration=262
            const importDeclaration = this.f.createImportDeclaration(
                undefined, undefined,
                ic,
                this.f.createStringLiteral(module, true)
            );
            (ic as any).parent = importDeclaration;

            this.sourceFile = this.f.updateSourceFile(this.sourceFile, [
                importDeclaration,
                ...this.sourceFile.statements
            ]) as any;
            (importDeclaration as any).parent = this.sourceFile;
            return t;
        }
    }

    extractName(node: Node): string {
        if (isIdentifier(node)) return node.escapedText as string;
        if (isPrivateIdentifier(node)) return node.escapedText as string;
        return '';
    }

    extractPropertyAccesses(e: Expression, res: string[] = []): string[] {
        if (isCallExpression(e)) {
            this.extractPropertyAccesses(e.expression, res);
        } else if (isParenthesizedExpression(e)) {
            this.extractPropertyAccesses(e.expression, res);
        } else if (isPropertyAccessExpression(e)) {
            res.push(this.extractName(e.name));
            this.extractPropertyAccesses(e.expression, res);
        }
        return res;
    }

    isManuallyTyped(decorators?: NodeArray<Decorator>): boolean {
        if (!decorators) return false;

        const mainDecoratorNames: (Types | string)[] = [
            'string', 'number', 'boolean', 'literal',
            'map', 'record', 'array', 'union',
            'type', 'any'
        ];

        for (const decorator of decorators) {
            const names = this.extractPropertyAccesses(decorator.expression);
            for (const name of names) {
                if (mainDecoratorNames.includes(name)) return true;
            }
        }

        return false;
    }

    shouldAddDecorator(node: Node) {
        const reflection = this.findReflection(node);
        if (reflection.mode === 'never') return false;
        if (isPropertyDeclaration(node)) return true;
        if (isMethodDeclaration(node)) return true;
        if (isParameter(node)) {
            if (node.parent && (isConstructorDeclaration(node.parent) || isMethodDeclaration(node.parent))) {
                return true;
            }
        }

        return true;
    }

    /**
     * If a decorator like @t.string found where a type is manually defined,
     * then this return false. For all other property/method/method or constructor parameters it returns true;
     */
    shouldExtractType(node: Node) {
        const reflection = this.findReflection(node);
        if (reflection.mode === 'never') return false;

        if (isPropertyDeclaration(node) && !this.isManuallyTyped(node.decorators)) return true;
        if (isMethodDeclaration(node) && !this.isManuallyTyped(node.decorators)) return true;

        if (isParameter(node) && !this.isManuallyTyped(node.decorators)) {
            if (node.parent && (isConstructorDeclaration(node.parent) || isMethodDeclaration(node.parent))) {
                return true;
            }
        }

        return false;
    }

    transformBundle(node: Bundle): Bundle {
        return node;
    }

    protected parseReflectionMode(mode?: typeof reflectionModes[number] | '' | boolean): typeof reflectionModes[number] {
        if ('boolean' === typeof mode) return mode ? 'default' : 'never';
        return mode || 'never';
    }

    protected resolvedTsConfig: { [path: string]: Record<string, any> } = {};

    findReflection(node: Node): { mode: typeof reflectionModes[number], import: string } {
        let current: Node | undefined = node;
        let reflection: typeof reflectionModes[number] | undefined;
        let reflectionImport: string | undefined;

        do {
            const tags = getJSDocTags(current);
            for (const tag of tags) {
                if (!reflection && tag.tagName.text === 'reflection' && 'string' === typeof tag.comment) {
                    reflection = this.parseReflectionMode(tag.comment as any || true);
                }
                if (!reflectionImport && tag.tagName.text === 'reflectionImport' && 'string' === typeof tag.comment) {
                    reflectionImport = this.parseReflectionMode(tag.comment as any);
                }
            }
            current = current.parent;
        } while (current);

        //nothing found, look in tsconfig.json
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
                        reflection = this.parseReflectionMode(tsConfig.reflection);
                    }

                    if (!reflectionImport && tsConfig.reflectionImport !== undefined) {
                        reflectionImport = tsConfig.reflectionImport;
                    }
                    if (reflection && reflectionImport) break;
                } catch (error: any) {
                    console.warn(`Could not parse ${tsconfigPath}: ${error}`);
                }
            }
            const next = join(currentDir, '..');
            if (resolve(next) === resolve(currentDir)) break; //we are at root
            currentDir = next;
        }

        return { mode: reflection || 'never', import: reflectionImport || '@deepkit/type' };
    }

    transformSourceFile(sourceFile: SourceFile): SourceFile {

        //without experimentalDecorators we can emit decorators
        if (!this.context.getCompilerOptions().experimentalDecorators) return sourceFile;

        this.sourceFile = sourceFile;
        if (!sourceFile.statements.length) return sourceFile;
        const reflection = this.findReflection(sourceFile);

        if (reflection.mode === 'never') {
            return sourceFile;
        } else if (reflection.mode === 'default' && reflection.import === '@deepkit/type') {
            // const deepkitType = this.host.getSourceFile('@deepkit/type');
            // if (!deepkitType) return sourceFile;
        }

        let typeDecorated = false;

        const visitorNeedsDecorator = (node: Node): Node => {
            if (isConstructorDeclaration(node) && this.shouldAddDecorator(node)) {
                typeDecorated = true;
            }

            if ((isPropertyDeclaration(node) || isMethodDeclaration(node)) && this.shouldAddDecorator(node)) {
                typeDecorated = true;
            }
            return visitEachChild(node, visitorNeedsDecorator, this.context);
        };

        visitNode(sourceFile, visitorNeedsDecorator);
        if (!typeDecorated) return sourceFile;

        const t = this.findOrCreateImportT(reflection.import);
        if (!t) return sourceFile;

        const visitor = (node: Node): Node => {
            if (isConstructorDeclaration(node) && this.shouldAddDecorator(node)) {
                return this.f.updateConstructorDeclaration(
                    node,
                    node.decorators, node.modifiers,
                    this.f.createNodeArray(node.parameters.map(parameter => {
                        if (!parameter.type) return parameter;
                        if (!this.shouldAddDecorator(parameter)) return parameter;
                        return this.f.updateParameterDeclaration(
                            parameter,
                            this.f.createNodeArray([...(parameter.decorators || []), this.getDecoratorFromType(t, parameter)]),
                            parameter.modifiers,
                            parameter.dotDotDotToken,
                            parameter.name, parameter.questionToken, parameter.type, parameter.initializer
                        );
                    })),
                    node.body
                );
            }

            if ((isPropertyDeclaration(node) || isMethodDeclaration(node)) && this.shouldAddDecorator(node)) {
                const typeDecorator = node.type ? this.getDecoratorFromType(t, node) : undefined;
                if (isMethodDeclaration(node)) {
                    const decorators = typeDecorator ? this.f.createNodeArray([...(node.decorators || []), typeDecorator]) : node.decorators;
                    const parameters = this.f.createNodeArray(node.parameters.map(parameter => {
                        if (!parameter.type) return parameter;
                        if (!this.shouldAddDecorator(parameter)) return parameter;
                        return this.f.updateParameterDeclaration(
                            parameter,
                            this.f.createNodeArray([...(parameter.decorators || []), this.getDecoratorFromType(t, parameter)]),
                            parameter.modifiers,
                            parameter.dotDotDotToken,
                            parameter.name, parameter.questionToken, parameter.type, parameter.initializer
                        );
                    }));
                    return this.f.updateMethodDeclaration(node, decorators, node.modifiers, node.asteriskToken, node.name, node.questionToken, node.typeParameters, parameters, node.type, node.body);
                }
                return this.f.updatePropertyDeclaration(
                    node,
                    typeDecorator ? this.f.createNodeArray([...(node.decorators || []), typeDecorator]) : node.decorators,
                    node.modifiers, node.name, node.questionToken, node.type, node.initializer
                );
            }
            return visitEachChild(node, visitor, this.context);
        };
        this.sourceFile = visitNode(this.sourceFile as any, visitor);

        return this.sourceFile;
    }

    createAccessorForEntityName(e: QualifiedName): PropertyAccessExpression {
        return this.f.createPropertyAccessExpression(
            isIdentifier(e.left) ? e.left : this.createAccessorForEntityName(e.left),
            e.right,
        );
    }

    resolveName(node: Node): string {
        if (isIdentifier(node)) return node.escapedText as string;
        if (isQualifiedName(node)) return node.getText();
        if (isTypeReferenceNode(node)) return this.resolveName(node.typeName);
        return '';
    }

    isNodeWithLocals(node: Node): node is (Node & { locals: SymbolTable | undefined }) {
        return 'locals' in node;
    }

    findSymbol(type: TypeNode | Identifier): Symbol | undefined {
        let current = type.parent;
        const name = this.resolveName(type);
        if (!name) return;
        do {
            if (this.isNodeWithLocals(current) && current.locals) {
                //check if its here
                const symbol = current.locals.get(name as __String);
                if (symbol) return symbol;
            }
            current = current.parent;
        } while (current);
        return;
    }

    findDeclarationInFile(sourceFile: SourceFile, declarationName: string): Declaration | undefined {
        if (this.isNodeWithLocals(sourceFile) && sourceFile.locals) {
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

    /**
     * Wraps t as `t.forwardRef(() => t)` to make sure we don't run into circular references or access identifiers that are not yet initialized.
     */
    protected forwardRef(t: Identifier, e: Expression) {
        return this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'forwardRef'), [], [
            this.f.createArrowFunction(undefined, undefined, [], undefined, undefined, e)
        ]);
    }

    getTypeExpression(t: Identifier, type: TypeNode, options: { allowShort?: boolean } = {}): Expression {
        if (isParenthesizedTypeNode(type)) return this.getTypeExpression(t, type.type);
        let markAsOptional: boolean = !!type.parent && isPropertyDeclaration(type.parent) && !!type.parent.questionToken;
        let markAsNullable = false;
        let wrap = (e: Expression) => {
            if (isParameter(type.parent) && isIdentifier(type.parent.name) && type.parent.name.escapedText) {
                e = this.f.createCallExpression(this.f.createPropertyAccessExpression(e, 'name'), [], [this.f.createStringLiteral(type.parent.name.escapedText, true)]);
            }

            if (markAsOptional) {
                e = this.f.createPropertyAccessExpression(e, 'optional');
            }
            if (markAsNullable) {
                e = this.f.createPropertyAccessExpression(e, 'nullable');
            }
            return e;
        };

        if (type.kind === SyntaxKind.StringKeyword) return wrap(this.f.createPropertyAccessExpression(t, 'string'));
        if (type.kind === SyntaxKind.NumberKeyword) return wrap(this.f.createPropertyAccessExpression(t, 'number'));
        if (type.kind === SyntaxKind.BooleanKeyword) return wrap(this.f.createPropertyAccessExpression(t, 'boolean'));
        if (type.kind === SyntaxKind.BigIntKeyword) return wrap(this.f.createPropertyAccessExpression(t, 'bigint'));
        if (isLiteralTypeNode(type)) {
            return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'literal'), [], [
                type.literal
            ]));
        }

        if (isArrayTypeNode(type)) {
            return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'array'), [], [this.getTypeExpression(t, type.elementType)]));
        }

        if (isTypeQueryNode(type)) {
            //typeof c
            return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'type'), [], [
                this.f.createPropertyAccessExpression(t, 'any'),
                this.forwardRef(t, isIdentifier(type.exprName) ? type.exprName : this.createAccessorForEntityName(type.exprName)),
            ]));
        }

        if (isTypeLiteralNode(type)) {
            //{[name: string]: number} => t.record(t.string, t.number)
            const [first] = type.members;
            if (first && isIndexSignatureDeclaration(first)) {
                const [parameter] = first.parameters;
                if (parameter && parameter.type) {
                    return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'record'), [], [
                        this.getTypeExpression(t, parameter.type),
                        this.getTypeExpression(t, first.type),
                    ]));
                }
            }
        }

        if (isTypeReferenceNode(type) && isIdentifier(type.typeName) && type.typeName.escapedText === 'Record' && type.typeArguments && type.typeArguments.length === 2) {
            //Record<string, number> => t.record(t.string, t.number)
            const [key, value] = type.typeArguments;
            return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'record'), [], [
                this.getTypeExpression(t, key),
                this.getTypeExpression(t, value),
            ]));
        }

        if (isTypeReferenceNode(type) && isIdentifier(type.typeName) && type.typeName.escapedText === 'Partial' && type.typeArguments && type.typeArguments.length === 1) {
            //partial<T> => t.partial(T)
            const [T] = type.typeArguments;
            return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'partial'), [], [
                this.getTypeExpression(t, T, { allowShort: true }),
            ]));
        }

        if (isUnionTypeNode(type)) {
            const args: Expression[] = [];
            let literalAdded = false;
            for (const subType of type.types) {
                if (subType.kind === SyntaxKind.NullKeyword) {
                    markAsNullable = true;
                } else if (subType.kind === SyntaxKind.UndefinedKeyword) {
                    markAsOptional = true;
                } else if (isLiteralTypeNode(subType)) {
                    if (subType.literal.kind === SyntaxKind.NullKeyword) {
                        markAsNullable = true;
                    } else {
                        args.push(subType.literal);
                        literalAdded = true;
                    }
                } else {
                    args.push(this.getTypeExpression(t, subType, { allowShort: true }));
                }
            }
            //t.array(t.union(t.number).optional) => t.array(t.number.optional)
            if (args.length === 1 && !literalAdded) return wrap(args[0]);
            return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'union'), [], args));
        }

        if (isTypeReferenceNode(type)) {
            if (isIdentifier(type.typeName) && type.typeName.escapedText === 'Date') return wrap(this.f.createPropertyAccessExpression(t, 'date'));
            const knownGlobals = [
                'Int8Array', 'Uint8Array', 'Uint8Array', 'Uint8ClampedArray',
                'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
                'ArrayBuffer', 'BigInt64Array',
                'String', 'Number', 'BigInt', 'Boolean',
            ];
            if (isIdentifier(type.typeName) && knownGlobals.includes(type.typeName.escapedText as string)) {
                return wrap(this.f.createCallExpression(
                    this.f.createPropertyAccessExpression(t, 'type'), [],
                    [type.typeName]
                ));
            }
            if (isIdentifier(type.typeName) && type.typeName.escapedText === 'Promise') {
                return wrap(this.f.createCallExpression(
                    this.f.createPropertyAccessExpression(t, 'promise'), [],
                    type.typeArguments ? type.typeArguments.map(T => this.getTypeExpression(t, T)) : []
                ));
            }

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
                return wrap(this.f.createPropertyAccessExpression(t, 'any'));
            }

            if (isInterfaceDeclaration(declaration) || isTypeAliasDeclaration(declaration)) {
                return wrap(this.f.createPropertyAccessExpression(t, 'any'));
            }

            if (isEnumDeclaration(declaration)) {
                return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'enum'), [], [
                    this.forwardRef(t, isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName))
                ]));
            }

            let e: Expression = this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'type'), [], [
                this.forwardRef(t, isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName))
            ]);

            if (type.typeArguments) {
                e = this.f.createCallExpression(
                    this.f.createPropertyAccessExpression(e, 'generic'), [],
                    type.typeArguments.map(T => this.getTypeExpression(t, T, { allowShort: true }))
                );
            }
            return wrap(e);
        }

        return wrap(this.f.createPropertyAccessExpression(t, 'any'));
    }

    getDecoratorFromType(t: Identifier, node: PropertyDeclaration | MethodDeclaration | ParameterDeclaration): Decorator {
        if (!node.type) throw new Error('No type given');

        if (this.shouldExtractType(node)) {
            return this.f.createDecorator(this.getTypeExpression(t, node.type));
        } else {
            if (isParameter(node) && isIdentifier(node.name) && node.name.escapedText) {
                return this.f.createDecorator(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'name'), [], [this.f.createStringLiteral(node.name.escapedText, true)]));
            } else {
                return this.f.createDecorator(t);
            }
        }
    }
}

let loaded = false;
export const transformer: CustomTransformerFactory = (context) => {
    if (!loaded) {
        process.stderr.write('@deepkit/type transformer loaded\n');
        loaded = true;
    }
    return new DeepkitTransformer(context);
};
