import {getClassSchema, PropertyCompilerSchema} from './decorators';
import {isValidEnumValue} from '@deepkit/core';
import {typedArrayNamesMap, Types} from './models';

export type JSONTypeGuard = (v: any) => boolean;
export type JSONTypeGuardFactory = (property: PropertyCompilerSchema) => JSONTypeGuard;

export const jsonTypeGuards = new Map<Types, JSONTypeGuardFactory>();

export function registerJSONTypeGuard(type: Types, factory: JSONTypeGuardFactory) {
    jsonTypeGuards.set(type, factory);
}

registerJSONTypeGuard('class', (property: PropertyCompilerSchema) => {
    const schema = getClassSchema(property.resolveClassType!);
    if (schema.discriminant) {
        schema.loadDefaults();
        const discriminant = schema.getProperty(schema.discriminant);
        const discriminantValue = discriminant.type === 'literal' ? discriminant.literalValue : discriminant.defaultValue;
        if (discriminantValue === undefined) {
            throw new Error(`Discriminant ${schema.getClassPropertyName(discriminant.name)} has no default value.`);
        }

        return (v: any) => {
            return v && v[discriminant.name] === discriminantValue;
        };
    }

    //we need to figure out what could be the discriminant
    for (const property of schema.getClassProperties().values()) {
        if (property.type !== 'literal') continue;

        return (v: any) => {
            return v && v[property.name] === property.literalValue;
        };
    }

    throw new Error(`Type of property ${property.name} has no discriminant or literal set. Could not discriminate the value.`);

});

registerJSONTypeGuard('string', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v;
    };
});

registerJSONTypeGuard('enum', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return undefined !== v && !isValidEnumValue(property.resolveClassType, v, property.allowLabelsAsValue);
    };
});

registerJSONTypeGuard('objectId', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v;
    };
});

registerJSONTypeGuard('uuid', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v;
    };
});

function typedArrayGuard(property: PropertyCompilerSchema) {
    return (v: any) => {
        return 'string' === typeof v;
    };
}

registerJSONTypeGuard('arrayBuffer', typedArrayGuard);
for (const name of typedArrayNamesMap.keys()) {
    registerJSONTypeGuard(name, typedArrayGuard);
}

const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/;
registerJSONTypeGuard('moment', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v && date.exec(v) !== null;
    };
});

registerJSONTypeGuard('date', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v && date.exec(v) !== null;
    };
});

registerJSONTypeGuard('any', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return true;
    };
});

registerJSONTypeGuard('union', (property: PropertyCompilerSchema) => {
    throw new Error('Union typechecking not implemented. Nested unions thus not supported yet.');
});

registerJSONTypeGuard('array', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return v && v.length !== undefined && 'string' !== typeof v || 'function' === typeof v.slice;
    };
});

registerJSONTypeGuard('map', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return v && 'object' === typeof v && 'function' !== typeof v.slice;
    };
});

registerJSONTypeGuard('partial', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return v && 'object' === typeof v && 'function' !== typeof v.slice;
    };
});

registerJSONTypeGuard('number', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'number' === typeof v;
    };
});

registerJSONTypeGuard('boolean', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'boolean' === typeof v;
    };
});

registerJSONTypeGuard('literal', (property: PropertyCompilerSchema) => {
    if ('number' === typeof property.literalValue) {
        return (v: any) => {
            return 0 + v === property.literalValue;
        };
    }

    if ('string' === typeof property.literalValue) {
        return (v: any) => {
            return '' + v === property.literalValue;
        };
    }

    if (true === property.literalValue) {
        return (v: any) => {
            return v === 'true' || v === '1' || v === 1 || v === true;
        };
    }

    if (false === property.literalValue) {
        return (v: any) => {
            return v === 'false' || v === '0' || v === 0 || v === false;
        };
    }

    return (v: any) => {
        return v === property.literalValue;
    };
});