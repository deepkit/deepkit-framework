import {
    createDecorator,
    createNodeArray,
    Decorator,
    Expression,
    Identifier,
    isArrayTypeNode,
    isIdentifier,
    isImportDeclaration,
    isIndexSignatureDeclaration,
    isLiteralTypeNode,
    isMethodDeclaration,
    isNamedImports,
    isParenthesizedTypeNode,
    isPropertyDeclaration,
    isSourceFile,
    isStringLiteral,
    isTypeLiteralNode,
    isTypeReferenceNode,
    isUnionTypeNode,
    MethodDeclaration,
    Node,
    NodeArray,
    NodeFactory,
    PropertyAccessExpression,
    PropertyDeclaration,
    QualifiedName,
    SourceFile,
    SyntaxKind,
    TransformerFactory,
    TypeNode,
    visitEachChild,
    visitNode
} from 'typescript';

function getTypeExpressions(f: NodeFactory, t: Identifier, types: NodeArray<TypeNode>): Expression[] {
    const args: Expression[] = [];
    for (const subType of types) {
        if (isLiteralTypeNode(subType)) {
            args.push(subType.literal);
        } else {
            args.push(getTypeExpression(f, t, t, subType));
        }
    }
    return args;
}

function resolveEntityName(f: NodeFactory, e: QualifiedName): PropertyAccessExpression {
    return f.createPropertyAccessExpression(
        isIdentifier(e.left) ? e.left : resolveEntityName(f, e.left),
        e.right,
    );
}

function getTypeExpression(f: NodeFactory, t: Identifier, entry: Expression, type: TypeNode): Expression {
    if (isParenthesizedTypeNode(type)) return getTypeExpression(f, t, entry, type.type);
    let markAsOptional: boolean = !!type.parent && isPropertyDeclaration(type.parent) && !!type.parent.questionToken;
    let markAsNullable = false;
    let wrap = (e: Expression) => {
        if (markAsOptional) {
            //its optional
            e = f.createPropertyAccessExpression(e, 'optional');
        }
        if (markAsNullable) {
            //its optional
            e = f.createPropertyAccessExpression(e, 'nullable');
        }
        return e;
    };

    if (type.kind === SyntaxKind.StringKeyword) return wrap(f.createPropertyAccessExpression(entry, 'string'));
    if (type.kind === SyntaxKind.NumberKeyword) return wrap(f.createPropertyAccessExpression(entry, 'number'));
    if (type.kind === SyntaxKind.BooleanKeyword) return wrap(f.createPropertyAccessExpression(entry, 'boolean'));
    if (isLiteralTypeNode(type)) {
        return wrap(f.createCallExpression(f.createPropertyAccessExpression(entry, 'literal'), [], [
            type.literal
        ]));
    }

    if (isArrayTypeNode(type)) {
        return wrap(f.createCallExpression(f.createPropertyAccessExpression(entry, 'array'), [], [getTypeExpression(f, t, t, type.elementType)]));
    }

    if (isTypeLiteralNode(type)) {
        //{[name: string]: number} => t.record(t.string, t.number)
        const [first] = type.members;
        if (first && isIndexSignatureDeclaration(first)) {
            const [parameter] = first.parameters;
            if (parameter && parameter.type) {
                return wrap(f.createCallExpression(f.createPropertyAccessExpression(entry, 'record'), [], [
                    getTypeExpression(f, t, entry, parameter.type),
                    getTypeExpression(f, t, entry, first.type),
                ]));
            }
        }
    }

    if (isTypeReferenceNode(type) && isIdentifier(type.typeName) && type.typeName.escapedText === 'Record' && type.typeArguments && type.typeArguments.length === 2) {
        //Record<string, number> => t.record(t.string, t.number)
        const [key, value] = type.typeArguments;
        return wrap(f.createCallExpression(f.createPropertyAccessExpression(entry, 'record'), [], [
            getTypeExpression(f, t, entry, key),
            getTypeExpression(f, t, entry, value),
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
                args.push(getTypeExpression(f, t, t, subType));
            }
        }
        //t.array(t.union(t.number).optional) => t.array(t.number.optional)
        if (args.length === 1 && !literalAdded) return wrap(args[0]);
        return wrap(f.createCallExpression(f.createPropertyAccessExpression(entry, 'union'), [], args));
    }

    if (isTypeReferenceNode(type)) {
        if (isIdentifier(type.typeName) && type.typeName.escapedText === 'Date') return wrap(f.createPropertyAccessExpression(entry, 'date'));
        return wrap(f.createCallExpression(f.createPropertyAccessExpression(entry, 'type'), [], [
            isIdentifier(type.typeName) ? type.typeName : resolveEntityName(f, type.typeName)
        ]));
    }

    return wrap(f.createPropertyAccessExpression(entry, 'any'));
}

function getDecoratorFromType(f: NodeFactory, t: Identifier, node: PropertyDeclaration | MethodDeclaration): Decorator | void {
    if (isPropertyDeclaration(node) && node.type) {
        const type = getTypeExpression(f, t, t, node.type);
        if (type) {
            return createDecorator(type);
        }
    }
}

export const transformer: TransformerFactory<SourceFile> = (context) => {
    return (fileNode) => {

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
        if (isSourceFile(fileNode)) {
            for (const statement of fileNode.statements) {
                if (isImportDeclaration(statement) && statement.importClause) {
                    if (isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === '@deepkit/type') {
                        if (statement.importClause.namedBindings && isNamedImports(statement.importClause.namedBindings)) {
                            for (const element of statement.importClause.namedBindings.elements) {
                                if (element.name.escapedText === 't') {
                                    importT = element.name;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!importT) return fileNode;

        const visitor = (node: Node): Node => {
            if ((isPropertyDeclaration(node) || isMethodDeclaration(node)) && node.decorators) {
                const typeDecorator = getDecoratorFromType(context.factory, importT!, node);
                if (typeDecorator) {
                    return { ...node, decorators: createNodeArray([...node.decorators, typeDecorator]) };
                }
            }

            return visitEachChild(node, visitor, context);
        };
        return visitNode(fileNode, visitor);
    };
};
