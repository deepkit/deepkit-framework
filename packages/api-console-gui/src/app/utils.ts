import { ClassSchema, PropertySchema } from '@deepkit/type';

export function trackByIndex(index: number) {
    return index;
}

interface ToTSInterfaceOptions {
    /**
     * When true `|undefined` is inferred from isOptional instead of !isValueRequired.
     */
    strictRequired?: true;

    direction?: 'serialize';
}

function isOptional(property: PropertySchema, options: ToTSInterfaceOptions) {
    if (!options.direction && (property.isReference || property.backReference)) return true;

    return options.strictRequired ? property.isOptional : !property.isValueRequired;
}

export function classSchemaToTSJSONInterface(schema: ClassSchema, options: ToTSInterfaceOptions = {}, depth: number = 1): string {
    const name = schema.getClassName();
    const lines: string[] = [];
    for (const v of schema.getProperties()) {
        lines.push('   '.repeat(depth) + v.name + (isOptional(v.jsonType || v, options) ? '?' : '') + ': ' + propertyToTSJSONInterface(v, options, false, depth + 1, ';'));
    }

    return `${name}${name ? ' ' : ''}{\n` + lines.join('\n') + '\n' + '   '.repeat(depth - 1) + '}';
}

export function propertyToTSJSONInterface(property: PropertySchema, options: ToTSInterfaceOptions = {}, withOptional: boolean = true, depth: number = 1, affix: string = ''): string {
    if (property.jsonType) return propertyToTSJSONInterface(property.jsonType, {}, withOptional, depth, affix) + ' //' + property.toString(false);

    if (property.type === 'class') {
        let pre = options.direction === 'serialize' && (property.isReference || property.backReference)
            ? propertyToTSJSONInterface(property.getResolvedClassSchema().getPrimaryField(), options, false, depth) + ' | '
            : '';
        return pre + classSchemaToTSJSONInterface(property.getResolvedClassSchema(), options, depth);
    }

    if (withOptional && isOptional(property, options)) affix += '|undefined';
    if (property.isNullable) affix += '|null';

    if (property.isBinary) return `{$type: 'binary', data: string}` + affix + ' //' + property.toString(false);

    if (property.type === 'array') {
        return `Array<${propertyToTSJSONInterface(property.templateArgs[0], options, true, depth, undefined)}>${affix}`;
    }
    if (property.type === 'promise') {
        if (property.templateArgs[0]) return propertyToTSJSONInterface(property.templateArgs[0], options, true, depth, undefined);
        return 'any';
    }
    if (property.type === 'map') {
        return `Record<${propertyToTSJSONInterface(property.templateArgs[0], {}, true, depth)}, ${propertyToTSJSONInterface(property.templateArgs[1], options, true, depth, undefined)}>${affix}`;
    }
    if (property.type === 'partial') {
        return `Partial<${propertyToTSJSONInterface(property.templateArgs[0], options, true, depth, undefined)}>${affix}`;
    }
    if (property.type === 'union') {
        return property.templateArgs.map(v => propertyToTSJSONInterface(v, options, true, depth, undefined)).join(' | ') + affix;
    }
    if (property.type === 'enum') return 'enum' + affix;

    if (property.type === 'date') return 'string' + affix + ' //Date';

    if (property.type === 'literal') return JSON.stringify(property.literalValue);

    return `${property.type}${affix}`;
}


export const methods: string[] = [
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'
];

export const headerStatusCodes: { [name: string]: string } = {
    '100': 'Continue',
    '101': 'Switching Protocols',
    '102': 'Processing',
    '200': 'OK',
    '201': 'Created',
    '202': 'Accepted',
    '203': 'Non-Authoritative Information',
    '204': 'No Content',
    '205': 'Reset Content',
    '206': 'Partial Content',
    '207': 'Multi-Status',
    '300': 'Multiple Choices',
    '301': 'Moved Permanently',
    '302': 'Moved Temporarily',
    '303': 'See Other',
    '304': 'Not Modified',
    '305': 'Use Proxy',
    '307': 'Temporary Redirect',
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '402': 'Payment Required',
    '403': 'Forbidden',
    '404': 'Not Found',
    '405': 'Method Not Allowed',
    '406': 'Not Acceptable',
    '407': 'Proxy Authentication Required',
    '408': 'Request Time-out',
    '409': 'Conflict',
    '410': 'Gone',
    '411': 'Length Required',
    '412': 'Precondition Failed',
    '413': 'Request Entity Too Large',
    '414': 'Request-URI Too Large',
    '415': 'Unsupported Media Type',
    '416': 'Requested Range Not Satisfiable',
    '417': 'Expectation Failed',
    '418': 'I\'m a teapot',
    '422': 'Unprocessable Entity',
    '423': 'Locked',
    '424': 'Failed Dependency',
    '425': 'Unordered Collection',
    '426': 'Upgrade Required',
    '428': 'Precondition Required',
    '429': 'Too Many Requests',
    '431': 'Request Header Fields Too Large',
    '500': 'Internal Server Error',
    '501': 'Not Implemented',
    '502': 'Bad Gateway',
    '503': 'Service Unavailable',
    '504': 'Gateway Time-out',
    '505': 'HTTP Version Not Supported',
    '506': 'Variant Also Negotiates',
    '507': 'Insufficient Storage',
    '509': 'Bandwidth Limit Exceeded',
    '510': 'Not Extended',
    '511': 'Network Authentication Required'
};
