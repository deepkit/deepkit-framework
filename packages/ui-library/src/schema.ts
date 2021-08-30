import { ClassSchema, PropertySchema } from '@deepkit/type';
import { removeIndent } from './utils';

interface ToTSInterfaceOptions {
    defaultValues?: {[name: string]: any};
}

function isOptional(property: PropertySchema, options: ToTSInterfaceOptions) {
    return property.isOptional;
}

export function classSchemaToTSInterface(schema: ClassSchema, options: ToTSInterfaceOptions = {}, depth: number = 1): string {
    const name = schema.getClassName();
    const lines: string[] = [];
    for (const v of schema.getProperties()) {
        const indent = '   '.repeat(depth);
        if (v.description) {
            for (const line of removeIndent(v.description).trim().split('\n')) {
                lines.push(indent + '//' + line);
            }
        }

        lines.push(indent + v.name + (isOptional(v.jsonType || v, options) ? '?' : '') + ': ' + propertyToTSInterface(v, options, false, depth + 1) + ';');
    }

    return `${name}${name ? ' ' : ''}{\n` + lines.join('\n') + '\n' + '   '.repeat(depth - 1) + '}';
}

export function propertyToTSInterface(property: PropertySchema, options: ToTSInterfaceOptions = {}, withOptional: boolean = true, depth: number = 1, affix: string = ''): string {
    if (withOptional && isOptional(property, options)) affix += '|undefined';
    if (property.isNullable) affix += '|null';

    const value = options.defaultValues ? options.defaultValues[property.name] : undefined;
    if (value !== undefined) {
        affix = ' = ' + JSON.stringify(value);
    }

    const nextOptions = {...options, defaultValues: value};

    if (property.type === 'class') {
        return classSchemaToTSInterface(property.getResolvedClassSchema(), nextOptions, depth) + affix;
    }

    if (property.type === 'array') {
        return `Array<${propertyToTSInterface(property.templateArgs[0], nextOptions, true, depth, undefined)}>${affix}`;
    }

    if (property.type === 'map') {
        return `Record<${propertyToTSInterface(property.templateArgs[0], {}, true, depth)}, ${propertyToTSInterface(property.templateArgs[1], nextOptions, true, depth, undefined)}>${affix}`;
    }
    if (property.type === 'partial') {
        return `Partial<${propertyToTSInterface(property.templateArgs[0], nextOptions, true, depth, undefined)}>${affix}`;
    }
    if (property.type === 'union') {
        return property.templateArgs.map(v => propertyToTSInterface(v, nextOptions, true, depth, undefined)).join(' | ') + affix;
    }
    if (property.type === 'enum') return property.classTypeName + affix;

    if (property.type === 'date') return 'Date' + affix + '';

    if (property.type === 'literal') return JSON.stringify(property.literalValue);

    return `${property.type}${affix}`;
}
