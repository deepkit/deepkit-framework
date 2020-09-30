import {
    compilerToString,
    getClassSchema,
    getClassToXFunction,
    getDataConverterJS,
    moment,
    nodeBufferToArrayBuffer,
    nodeBufferToTypedArray,
    jsonSerializer,
    PropertyCompilerSchema,
    typedArrayNamesMap,
    typedArrayToBuffer
} from '@deepkit/type';
import {Binary, ObjectID} from 'bson';
import {hexTable} from '@deepkit/bson';
import * as mongoUuid from 'mongo-uuid';

export function uuid4Binary(u?: string): Binary {
    return mongoUuid(Binary, u);
}

export const mongoSerializer = new class extends jsonSerializer.fork('mongo') {
};

mongoSerializer.fromClass.noop('date'); //we dont stringify date
mongoSerializer.fromClass.register('string', compilerToString);

export function uuid4Stringify(binary: Binary): string {
    if (!binary.buffer) {
        console.error('uuid4Stringify', binary);
        throw new Error('Invalid argument. Binary required.');
    }
    const buffer = binary.buffer;
    return hexTable[buffer[0]] + hexTable[buffer[1]] + hexTable[buffer[2]] + hexTable[buffer[3]]
        + '-'
        + hexTable[buffer[4]] + hexTable[buffer[5]]
        + '-'
        + hexTable[buffer[6]] + hexTable[buffer[7]]
        + '-'
        + hexTable[buffer[8]] + hexTable[buffer[9]]
        + '-'
        + hexTable[buffer[10]] + hexTable[buffer[11]] + hexTable[buffer[12]] + hexTable[buffer[13]] + hexTable[buffer[14]] + hexTable[buffer[15]]
        ;
}

mongoSerializer.fromClass.register('undefined', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //mongo does not support 'undefined' as column type, so we convert automatically to null
    return `${setter} = null;`;
});

mongoSerializer.fromClass.register('null', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //mongo does not support 'undefined' as column type, so we convert automatically to null
    return `${setter} = null;`;
});

mongoSerializer.toClass.register('null', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //mongo does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isNullable) return `${setter} = null;`;
    if (property.isOptional) return `${setter} = undefined;`;

    return ``;
});

mongoSerializer.toClass.register('undefined', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //mongo does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return `${setter} = undefined;`;
    if (property.isNullable) return `${setter} = null;`;

    return ``;
});

mongoSerializer.fromClass.register('moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = ${accessor}.toDate();`;
});

mongoSerializer.toClass.register('moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = moment(${accessor});`,
        context: {moment}
    };
});

mongoSerializer.toClass.register('uuid', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `
        try {
            //deepkit/bson already returns a string for uuid
            ${setter} = 'string' === typeof ${accessor} ? ${accessor} : uuid4Stringify(${accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}: ' + error);
        }
        `,
        context: {uuid4Stringify}
    };
});

mongoSerializer.fromClass.register('uuid', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `
        try {
            ${setter} = uuid4Binary(${accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}');
        }
        `,
        context: {uuid4Binary}
    };
});

mongoSerializer.toClass.register('objectId', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `
    try {
        //deepkit/bson already returns a string for uuid
        ${setter} = 'string' === typeof ${accessor} ? ${accessor} : ${accessor}.toHexString();
    } catch (error) {
        throw new TypeError('Invalid ObjectID given in property ${property.name}');
    }
    `;
});

mongoSerializer.fromClass.register('objectId', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `
    try {
        ${setter} = new ObjectID(${accessor});
    } catch (error) {
        throw new TypeError('Invalid ObjectID given in property ${property.name}');
    }
        `,
        context: {ObjectID}
    };
});

mongoSerializer.toClass.extend('class', (setter: string, accessor: string, property: PropertyCompilerSchema, {reserveVariable, serializerCompilers, rootContext, jitStack}) => {
    //when property is a reference, then we stored in the database the actual primary key and used this
    //field as foreignKey. This makes it necessary to convert it differently (concretely we treat it as the primary)
    const classSchema = getClassSchema(property.resolveClassType!);

    if (property.isReference) {
        const classType = reserveVariable();
        const primary = classSchema.getPrimaryField();

        return {
            template: getDataConverterJS(setter, accessor, primary, serializerCompilers, rootContext, jitStack),
            context: {
                [classType]: property.resolveClassType,
                getClassToXFunction,
            }
        };
    }
    return;
});

mongoSerializer.fromClass.extend('class', (setter: string, accessor: string, property: PropertyCompilerSchema, {reserveVariable, serializerCompilers, rootContext, jitStack}) => {
    //When property is a reference we store the actual primary (as foreign key) of the referenced instance instead of the actual instance.
    //This way we implemented basically relations in mongodb
    const classSchema = getClassSchema(property.resolveClassType!);
    if (property.isReference) {
        const classType = reserveVariable();
        const primary = classSchema.getPrimaryField();
        return {
            template: `
            if (${accessor} instanceof ${classType}) {
                ${getDataConverterJS(setter, `${accessor}.${primary.name}`, primary, serializerCompilers, rootContext, jitStack)}
            } else {
                //we treat the input as if the user gave the primary key directly
                ${getDataConverterJS(setter, `${accessor}`, primary, serializerCompilers, rootContext, jitStack)}
            }
            `,
            context: {
                [classType]: property.resolveClassType,
            }
        };
    }

    return;
});

mongoSerializer.fromClass.registerForBinary((setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = new Binary(typedArrayToBuffer(${accessor}));`,
        context: {
            Binary,
            typedArrayToBuffer
        }
    };
});

mongoSerializer.toClass.registerForBinary((setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = nodeBufferToTypedArray(${accessor}.buffer, typedArrayNamesMap.get('${property.type}'));`,
        context: {
            typedArrayNamesMap,
            nodeBufferToTypedArray
        }
    };
});

mongoSerializer.toClass.register('arrayBuffer', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = nodeBufferToArrayBuffer(${accessor}.buffer);`,
        context: {
            nodeBufferToArrayBuffer
        }
    };
});

mongoSerializer.fromClass.register('arrayBuffer', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = new Binary(Buffer.from(${accessor}));`,
        context: {
            Buffer,
            Binary
        }
    };
});
