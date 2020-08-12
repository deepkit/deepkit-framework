import {getClassSchema, PropertyCompilerSchema, typedArrayNamesMap, Types} from './decorators';
import {isValidEnumValue} from '@super-hornet/core';

export type TypeGuardFactory = (property: PropertyCompilerSchema) => ((v: any) => boolean);

export const typeGuards = new Map<Types, TypeGuardFactory>();

export function registerTypeGuard(type: Types, factory: TypeGuardFactory) {
    typeGuards.set(type, factory);
}

registerTypeGuard('class', (property: PropertyCompilerSchema) => {
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

registerTypeGuard('string', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v;
    };
});

registerTypeGuard('enum', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return undefined !== v && !isValidEnumValue(property.resolveClassType, v, property.allowLabelsAsValue);
    };
});

registerTypeGuard('objectId', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v;
    };
});

registerTypeGuard('uuid', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v;
    };
});

function typedArrayGuard(property: PropertyCompilerSchema) {
    return (v: any) => {
        return 'string' === typeof v;
    };
}

registerTypeGuard('arrayBuffer', typedArrayGuard);
for (const name of typedArrayNamesMap.keys()) {
    registerTypeGuard(name, typedArrayGuard);
}

const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/;
registerTypeGuard('moment', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v && date.exec(v) !== null;
    };
});

registerTypeGuard('date', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'string' === typeof v && date.exec(v) !== null;
    };
});

registerTypeGuard('any', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return true;
    };
});

registerTypeGuard('union', (property: PropertyCompilerSchema) => {
    throw new Error('Union typechecking not implemented. Nested unions thus not supported yet.');
    return (v: any) => {
        return true;
    };
});

registerTypeGuard('array', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return v && v.length !== undefined && 'string' !== typeof v || 'function' === typeof v.slice;
    };
});

registerTypeGuard('map', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return v && 'object' === typeof v && 'function' !== typeof v.slice;
    };
});

registerTypeGuard('partial', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return v && 'object' === typeof v && 'function' !== typeof v.slice;
    };
});

registerTypeGuard('number', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'number' === typeof v;
    };
});

registerTypeGuard('boolean', (property: PropertyCompilerSchema) => {
    return (v: any) => {
        return 'boolean' === typeof v;
    };
});

registerTypeGuard('literal', (property: PropertyCompilerSchema) => {
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