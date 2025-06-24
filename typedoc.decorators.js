const td = require('typedoc');
const ts = td.TypeScript;

/** @param {td.Application} app */
exports.load = function(app) {
    // Add decorator info to reflections
    // if you need parameters, you need app.converter.on(td.Converter.EVENT_CREATE_PARAMETER)
    app.converter.on(td.Converter.EVENT_CREATE_DECLARATION, addDecoratorInfo);

    // Add decorator info to serialized json
    app.serializer.addSerializer({
        priority: 0,
        supports(item) {
            return item instanceof td.DeclarationReflection;
        },
        toObject(item, obj, _ser) {
            if (item.decorators) {
                obj.decorators = item.decorators;
            }
            return obj;
        },
    });
};

/**
 * @param {import('typedoc').Context} context
 * @param {import('typedoc').DeclarationReflection} decl
 */
function addDecoratorInfo(context, decl) {
    const symbol = context.project.getSymbolFromReflection(decl);
    if (!symbol) return;

    const declaration = symbol.valueDeclaration;
    if (!declaration || !ts.isClassDeclaration(declaration)) return;

    const decorators = ts.getDecorators(declaration);
    if (!decorators?.length) return;

    decl.decorators = [];

    for (const decorator of decorators) {
        const expr = decorator.expression;
        // Check if @Component, @Directive, or @Pipe
        if (
            ts.isCallExpression(expr) &&
            ts.isIdentifier(expr.expression) &&
            ['Component', 'Directive', 'Pipe'].includes(expr.expression.text)
        ) {
            const name = expr.expression.text;

            const arg = expr.arguments[0];
            if (!arg || !ts.isObjectLiteralExpression(arg)) continue;

            const selectorProp = arg.properties.find(
                (p) =>
                    ts.isPropertyAssignment(p) &&
                    ts.isIdentifier(p.name) &&
                    p.name.text === 'selector',
            );

            if (
                selectorProp &&
                ts.isPropertyAssignment(selectorProp) &&
                ts.isStringLiteral(selectorProp.initializer)
            ) {
                decl.decorators.push({
                    name: name,
                    selector: selectorProp.initializer.text,
                });
            }
        }
    }
}
