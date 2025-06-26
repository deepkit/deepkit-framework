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
            obj.input = item.input;
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
    if (!declaration) return;

    // 🔍 Extract decorators from class declarations (e.g. @Component)
    if (ts.isClassDeclaration(declaration)) {
        const decorators = ts.getDecorators(declaration) || [];
        decl.decorators = [];

        for (const decorator of decorators) {
            const expr = decorator.expression;

            if (
                ts.isCallExpression(expr) &&
                ts.isIdentifier(expr.expression) &&
                ['Component', 'Directive', 'Pipe'].includes(expr.expression.text)
            ) {
                const name = expr.expression.text;
                const arg = expr.arguments[0];

                if (arg && ts.isObjectLiteralExpression(arg)) {
                    const selectorProp = arg.properties.find(
                        (p) =>
                            ts.isPropertyAssignment(p) &&
                            ts.isIdentifier(p.name) &&
                            p.name.text === 'selector',
                    );

                    if (
                        selectorProp &&
                        ts.isStringLiteral(selectorProp.initializer)
                    ) {
                        decl.decorators.push({
                            name,
                            selector: selectorProp.initializer.text,
                        });
                    }
                }
            }
        }
    }

    // 🔍 Extract signal-style initializer from property declarations
    if (ts.isPropertyDeclaration(declaration) && declaration.initializer && ts.isCallExpression(declaration.initializer)) {
        const init = declaration.initializer;
        // input() / model()
        const isInputOptional = ts.isIdentifier(init.expression) && ['input', 'model'].includes(init.expression.text);
        // input.required() / model.required()
        const isInputRequired = ts.isPropertyAccessExpression(init.expression)
            && ts.isIdentifier(init.expression.expression)
            && ['input', 'model'].includes(init.expression.expression.text)
            && ts.isIdentifier(init.expression.name)
            && init.expression.name.text === 'required';

        if (isInputOptional || isInputRequired) {
            const alias = findAlias(init);
            decl.input = {
                required: isInputRequired,
                alias: alias,
            };
        }
    }
}

function findAlias(init) {
    for (const arg of init.arguments) {
        if (!ts.isObjectLiteralExpression(arg)) continue;
        for (const prop of arg.properties) {
            if (
                ts.isPropertyAssignment(prop) &&
                ts.isIdentifier(prop.name) &&
                prop.name.text === 'alias' &&
                ts.isStringLiteral(prop.initializer)
            ) {
                return prop.initializer.text;
            }
        }
    }
}
