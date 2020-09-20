import {
    getClassSchema,
    getClassToXFunction,
    getDataConverterJS,
    moment,
    nodeBufferToArrayBuffer,
    nodeBufferToTypedArray,
    plainSerializer,
    PropertyCompilerSchema,
    typedArrayNamesMap,
    typedArrayToBuffer
} from '@deepkit/type';

export const hexTable: string[] = [];
for (let i = 0; i < 256; i++) {
    hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

export const sqlSerializer = new class extends plainSerializer.fork('sql') {
};

export function uuid4Binary(u: string): Buffer {
    return Buffer.from(u.replace(/-/g, ''), 'hex');
}

export function uuid4Stringify(buffer: Buffer): string {
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

sqlSerializer.fromClass.register('undefined', (setter: string) => {
    //sql does not support 'undefined' as column type, so we convert automatically to null
    return `${setter} = null;`;
});

sqlSerializer.toClass.register('null', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //sql does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return `${setter} = undefined;`;
    if (property.isNullable) return `${setter} = null;`;

    return ``;
});

sqlSerializer.toClass.register('undefined', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //sql does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return `${setter} = undefined;`;
    if (property.isNullable) return `${setter} = null;`;

    return ``;
});

//SQL escape does the job.
sqlSerializer.fromClass.register('date', (setter, accessor) => {
    return `${setter} = ${accessor}`;
});

sqlSerializer.fromClass.register('moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = ${accessor}.toDate();`;
});

sqlSerializer.toClass.register('moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = moment(${accessor});`,
        context: {moment}
    };
});

sqlSerializer.toClass.register('uuid', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
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

sqlSerializer.fromClass.register('uuid', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
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

sqlSerializer.toClass.extend('class', (setter: string, accessor: string, property: PropertyCompilerSchema, {reserveVariable, serializerCompilers, rootContext, jitStack}) => {
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

sqlSerializer.fromClass.extend('class', (setter: string, accessor: string, property: PropertyCompilerSchema, {reserveVariable, serializerCompilers, rootContext, jitStack}) => {
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

sqlSerializer.fromClass.registerForBinary((setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = typedArrayToBuffer(${accessor});`,
        context: {
            typedArrayToBuffer
        }
    };
});

sqlSerializer.toClass.registerForBinary((setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = nodeBufferToTypedArray(${accessor}, typedArrayNamesMap.get('${property.type}'));`,
        context: {
            typedArrayNamesMap,
            nodeBufferToTypedArray
        }
    };
});

sqlSerializer.toClass.register('arrayBuffer', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = nodeBufferToArrayBuffer(${accessor});`,
        context: {
            nodeBufferToArrayBuffer
        }
    };
});

sqlSerializer.fromClass.register('arrayBuffer', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = Buffer.from(${accessor});`,
        context: {
            Buffer,
        }
    };
});
