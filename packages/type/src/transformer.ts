import {
    __String,
    Declaration,
    Decorator,
    Expression,
    Identifier,
    isArrayTypeNode,
    isEnumDeclaration,
    isIdentifier,
    isImportDeclaration,
    isImportSpecifier,
    isIndexSignatureDeclaration,
    isLiteralTypeNode,
    isMethodDeclaration,
    isNamedImports,
    isParameter,
    isParenthesizedTypeNode,
    isPropertyDeclaration,
    isSourceFile,
    isStringLiteral,
    isTypeLiteralNode,
    isTypeReferenceNode,
    isUnionTypeNode,
    MethodDeclaration,
    Node,
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
    TransformerFactory,
    TypeNode,
    visitEachChild,
    visitNode
} from 'typescript';

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

    transform<T extends Node>(sourceFile: T): T {
        // const importT = context.factory.createImportDeclaration(
        //     undefined, undefined,
        //     context.factory.createImportClause(false, context.factory.createIdentifier('t'), undefined),
        //     context.factory.createIdentifier('@deepkit/type')
        // );
        // context.factory.updateSourceFile(fileNode, [
        //     importT,
        //     ...fileNode.statements,
        // ]);
        let importT: Identifier | undefined = undefined;
        if (isSourceFile(sourceFile)) {
            this.sourceFile = sourceFile;
            for (const statement of sourceFile.statements) {
                if (isImportDeclaration(statement) && statement.importClause) {
                    if (isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === '@deepkit/type') {
                        if (statement.importClause.namedBindings && isNamedImports(statement.importClause.namedBindings)) {
                            for (const element of statement.importClause.namedBindings.elements) {
                                if (element.name.text === 't') {
                                    importT = element.name;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            return sourceFile;
        }

        if (!importT) return sourceFile;

        const visitor = (node: Node): Node => {
            if ((isPropertyDeclaration(node) || isMethodDeclaration(node)) && node.type && node.decorators) {
                const typeDecorator = this.getDecoratorFromType(importT!, node);
                if (isMethodDeclaration(node)) {
                    return {
                        ...node,
                        decorators: this.f.createNodeArray([...node.decorators, typeDecorator]),
                        parameters: this.f.createNodeArray(node.parameters.map(parameter => {
                            if (!parameter.type) return parameter;
                            return { ...parameter, decorators: this.f.createNodeArray([...(parameter.decorators || []), this.getDecoratorFromType(importT!, parameter)]) };
                        }))
                    } as MethodDeclaration;
                }
                return { ...node, decorators: this.f.createNodeArray([...node.decorators, typeDecorator]) };
            }
            return visitEachChild(node, visitor, this.context);
        };
        return visitNode(sourceFile, visitor);
    }


    resolveEntityName(e: QualifiedName): PropertyAccessExpression {
        return this.f.createPropertyAccessExpression(
            isIdentifier(e.left) ? e.left : this.resolveEntityName(e.left),
            e.right,
        );
    }

    isNodeWithLocals(node: Node): node is (Node & { locals: SymbolTable | undefined }) {
        return 'locals' in node;
    }

    findSymbol(type: TypeNode): Symbol | undefined {
        let current = type.parent;
        const name = isIdentifier(type) ? type.text : type.getText();
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
                const declaration = this.findDeclaration(symbol);
                if (declaration && isEnumDeclaration(declaration)) {
                    return wrap(this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'enum'), [], [
                        isIdentifier(type.typeName) ? type.typeName : this.resolveEntityName(type.typeName)
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
                return isIdentifier(type.typeName) ? type.typeName : this.resolveEntityName(type.typeName);
            }

            let e: Expression = this.f.createCallExpression(this.f.createPropertyAccessExpression(t, 'type'), [], [
                isIdentifier(type.typeName) ? type.typeName : this.resolveEntityName(type.typeName)
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

        if (isParameter(node) && isIdentifier(node.name)) {
            e = this.f.createCallExpression(this.f.createPropertyAccessExpression(e, 'name'), [], [this.f.createStringLiteral(node.name.text, true)]);
        }

        return this.f.createDecorator(e);
    }
}

export const transformer: TransformerFactory<SourceFile> = (context) => {
    const deepkitTransformer = new DeepkitTransformer(context);
    return <T extends Node>(sourceFile: T): T => {
        return deepkitTransformer.transform(sourceFile);
    };
};
