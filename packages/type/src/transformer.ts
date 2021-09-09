import {
    __String,
    Bundle,
    ConstructorDeclaration,
    CustomTransformerFactory,
    Declaration,
    Decorator,
    Expression,
    Identifier,
    ImportSpecifier,
    isArrayTypeNode,
    isCallExpression,
    isConstructorDeclaration,
    isEnumDeclaration,
    isIdentifier,
    isImportDeclaration,
    isImportSpecifier,
    isIndexSignatureDeclaration,
    isInterfaceDeclaration,
    isLiteralTypeNode,
    isMethodDeclaration,
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
    isTypeReferenceNode,
    isUnionTypeNode,
    MethodDeclaration,
    Node,
    NodeArray,
    NodeFactory,
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

// function getTypeExpressions(f: NodeFactory, t: Identifier, types: NodeArray<TypeNode>): Expression[] {
//     const args: Expression[] = [];
//     for (const subType of types) {
//         if (isLiteralTypeNode(subType)) {
//             args.push(subType.literal);
//         } else {
//             args.push(getTypeExpression(f, t, subType));
//         }
//     }
//     return args;
// }

export class DeepkitTransformer {
    protected host!: ScriptReferenceHost;
    protected f: NodeFactory;

    sourceFile!: SourceFile;

    constructor(
        protected context: TransformationContext,
    ) {
        this.f = context.factory;
        this.host = (context as any).getEmitHost() as ScriptReferenceHost;
    }

    protected findTFromImports() {
        for (const statement of this.sourceFile.statements) {
            if (isImportDeclaration(statement) && statement.importClause) {
                if (isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === '@deepkit/type') {
                    if (statement.importClause.namedBindings && isNamedImports(statement.importClause.namedBindings)) {
                        for (const element of statement.importClause.namedBindings.elements) {
                            if (element.name.text === 't') {
                                return element.name;
                            }
                        }
                    }
                }
            }
        }
        return;
    }

    findOrCreateImportT(): Identifier {
        const t = this.findTFromImports();
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
                this.f.createStringLiteral('@deepkit/type', true)
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

    hasValidDecorator(node: Node) {
        if (isPropertyDeclaration(node) && !this.isManuallyTyped(node.decorators)) return !!node.decorators;
        if (isMethodDeclaration(node) && !this.isManuallyTyped(node.decorators)) return !!node.decorators;

        if (isParameter(node) && !this.isManuallyTyped(node.decorators)) {
            if (isConstructorDeclaration(node.parent)) {
                return !!node.parent.parent.decorators;
            } else {
                return !!node.parent.decorators;
            }
        }

        if (isConstructorDeclaration(node)) return !!node.parent.decorators;

        return false;
    }

    transformBundle(node: Bundle): Bundle {
        return node;
    }

    transformSourceFile(sourceFile: SourceFile): SourceFile {
        const deepkitType = this.host.getSourceFile('@deepkit/type');
        if (!deepkitType) return sourceFile;

        this.sourceFile = sourceFile;
        let typeDecorated = false;

        const visitorNeedsDecorator = (node: Node): Node => {
            if (isConstructorDeclaration(node) && this.hasValidDecorator(node)) {
                typeDecorated = true;
            }

            if ((isPropertyDeclaration(node) || isMethodDeclaration(node)) && this.hasValidDecorator(node)) {
                typeDecorated = true;
            }
            return visitEachChild(node, visitorNeedsDecorator, this.context);
        };

        visitNode(sourceFile, visitorNeedsDecorator);
        if (!typeDecorated) return sourceFile;

        const t = this.findOrCreateImportT();

        const visitor = (node: Node): Node => {
            if (isConstructorDeclaration(node) && this.hasValidDecorator(node)) {
                return {
                    ...node,
                    parameters: this.f.createNodeArray(node.parameters.map(parameter => {
                        if (!parameter.type) return parameter;
                        if (!this.hasValidDecorator(parameter)) return parameter;
                        return {
                            ...parameter,
                            decorators: this.f.createNodeArray([...(parameter.decorators || []), this.getDecoratorFromType(t, parameter)])
                        };
                    }))
                } as ConstructorDeclaration;
            }

            if ((isPropertyDeclaration(node) || isMethodDeclaration(node)) && this.hasValidDecorator(node)) {
                const typeDecorator = node.type ? this.getDecoratorFromType(t, node) : undefined;
                if (isMethodDeclaration(node)) {
                    return {
                        ...node,
                        decorators: typeDecorator ? this.f.createNodeArray([...(node.decorators || []), typeDecorator]) : node.decorators,
                        parameters: this.f.createNodeArray(node.parameters.map(parameter => {
                            if (!parameter.type) return parameter;
                            if (!this.hasValidDecorator(parameter)) return parameter;
                            return {
                                ...parameter,
                                decorators: this.f.createNodeArray([...(parameter.decorators || []), this.getDecoratorFromType(t, parameter)])
                            };
                        }))
                    } as MethodDeclaration;
                }
                return { ...node, decorators: typeDecorator ? this.f.createNodeArray([...(node.decorators || []), typeDecorator]) : node.decorators };
            }
            return visitEachChild(node, visitor, this.context);
        };
        this.sourceFile = visitNode(this.sourceFile as any, visitor);

        if (this.touchImportSpecifiers.length) {
            const visitorTouchImports = (node: Node): Node => {
                if (isImportSpecifier(node) && this.touchImportSpecifiers.includes(node)) {
                    //we have to make a copy from used imports so TS does no ellision on it.
                    return {...node, original: node} as any;
                }

                return visitEachChild(node, visitorTouchImports, this.context);
            };
            this.sourceFile = visitNode(this.sourceFile as any, visitorTouchImports);
        }

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

    findSymbol(type: TypeNode): Symbol | undefined {
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

    findDeclaration(symbol: Symbol): Declaration | undefined {
        if (symbol && symbol.declarations && symbol.declarations[0]) {
            const declaration = symbol.declarations[0];
            if (!declaration) return;
            if (isImportSpecifier(declaration)) {
                const declarationName = declaration.name.text;
                const imp = declaration.parent.parent.parent;
                if (isImportDeclaration(imp) && isStringLiteral(imp.moduleSpecifier)) {
                    let fromFile = imp.moduleSpecifier.text;
                    if (!fromFile.endsWith('.js') && !fromFile.endsWith('.ts')) fromFile += '.ts';
                    const source = this.host.getSourceFile(fromFile.startsWith('./') ? this.sourceFile.fileName + '/.' + fromFile : fromFile);
                    if (source && this.isNodeWithLocals(source) && source.locals) {
                        const declarationSymbol = source.locals.get(declarationName as __String);
                        if (declarationSymbol && declarationSymbol.declarations) return declarationSymbol.declarations[0];
                    }
                }
            }
            return declaration;
        }
        return;
    }

    protected touchImportSpecifiers: ImportSpecifier[] = [];

    getTypeExpression(t: Identifier, type: TypeNode, options: { allowShort?: boolean } = {}): Expression {
        if (isParenthesizedTypeNode(type)) return this.getTypeExpression(t, type.type);
        let markAsOptional: boolean = !!type.parent && isPropertyDeclaration(type.parent) && !!type.parent.questionToken;
        let markAsNullable = false;
        let wrap = (e: Expression) => {
            if (markAsOptional) {
                //its optional
                e = this.f.createPropertyAccessExpression(e, 'optional');
            }
            if (markAsNullable) {
                //its optional
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

        if (isTypeReferenceNode(type) && isIdentifier(type.typeName) && type.typeName.text === 'Record' && type.typeArguments && type.typeArguments.length === 2) {
            //Record<string, number> => t.record(t.string, t.number)
            const [key, value] = type.typeArguments;
            return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'record'), [], [
                this.getTypeExpression(t, key),
                this.getTypeExpression(t, value),
            ]));
        }

        if (isTypeReferenceNode(type) && isIdentifier(type.typeName) && type.typeName.text === 'Partial' && type.typeArguments && type.typeArguments.length === 1) {
            //Record<string, number> => t.record(t.string, t.number)
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
            if (isIdentifier(type.typeName) && type.typeName.text === 'Date') return wrap(this.f.createPropertyAccessExpression(t, 'date'));

            const symbol = this.findSymbol(type);
            if (symbol) {
                const incomingDeclaration = symbol.declarations ? symbol.declarations[0] : undefined;
                if (incomingDeclaration && isImportSpecifier(incomingDeclaration)) {
                    this.touchImportSpecifiers.push(incomingDeclaration);
                }

                const declaration = this.findDeclaration(symbol);
                if (!declaration) {
                    //non existing references are ignored
                    return wrap(this.f.createPropertyAccessExpression(t, 'any'));
                }
                if (isInterfaceDeclaration(declaration) || isTypeAliasDeclaration(declaration)) {
                    return wrap(this.f.createPropertyAccessExpression(t, 'any'));
                }
                if (isEnumDeclaration(declaration)) {
                    return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'enum'), [], [
                        isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName)
                    ]));
                }
            }
            if (isIdentifier(type.typeName) && type.typeName.text === 'Promise') {
                return wrap(this.f.createCallExpression(
                    this.f.createPropertyAccessExpression(t, 'promise'), [],
                    type.typeArguments ? type.typeArguments.map(T => this.getTypeExpression(t, T)) : []
                ));
            }

            if (options?.allowShort && !type.typeArguments) {
                return isIdentifier(type.typeName) ? type.typeName : this.createAccessorForEntityName(type.typeName);
            }

            const parent = this.sourceFile;

            function copy(node: Identifier) {
                node = { ...node, parent: parent };
                (node as any).original = undefined;
                return node;
            }

            let e: Expression = this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'type'), [], [
                isIdentifier(type.typeName) ? copy(type.typeName) : this.createAccessorForEntityName(type.typeName)
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

        let e = this.getTypeExpression(t, node.type);

        if (isParameter(node) && isIdentifier(node.name) && node.name.text) {
            e = this.f.createCallExpression(this.f.createPropertyAccessExpression(e, 'name'), [], [this.f.createStringLiteral(node.name.text, true)]);
        }

        return this.f.createDecorator(e);
    }
}

export const transformer: CustomTransformerFactory = (context) => {
    return new DeepkitTransformer(context);
};
