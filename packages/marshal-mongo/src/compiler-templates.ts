import {
    compilerToNumber,
    compilerToString,
    compilerXToUnionClass,
    createClassToXFunction,
    createXToClassFunction,
    getClassSchema,
    getDataConverterJS,
    moment,
    nodeBufferToArrayBuffer,
    nodeBufferToTypedArray,
    PropertyCompilerSchema,
    registerConverterCompiler,
    typedArrayNamesMap,
    typedArrayToBuffer
} from '@super-hornet/marshal';
import {Binary, ObjectID} from 'bson';
import {hexTable} from '@super-hornet/marshal-bson';
import * as mongoUuid from 'mongo-uuid';

export function uuid4Binary(u?: string): Binary {
    return mongoUuid(Binary, u);
}

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

registerConverterCompiler('class', 'mongo', 'string', compilerToString);
registerConverterCompiler('mongo', 'class', 'string', compilerToString);

registerConverterCompiler('class', 'mongo', 'number', compilerToNumber);
registerConverterCompiler('mongo', 'class', 'number', compilerToNumber);

registerConverterCompiler('class', 'mongo', 'undefined', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //mongo does not support 'undefined' as column type, so we convert automatically to null
    return `${setter} = null;`;
});

registerConverterCompiler('mongo', 'class', 'null', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //mongo does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return `${setter} = undefined;`;
    if (property.isNullable) return `${setter} = null;`;

    return ``;
});

registerConverterCompiler('mongo', 'class', 'undefined', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    //mongo does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return `${setter} = undefined;`;
    if (property.isNullable) return `${setter} = null;`;

    return ``;
});

registerConverterCompiler('class', 'mongo', 'moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = ${accessor}.toDate();`;
});

registerConverterCompiler('mongo', 'class', 'moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = moment(${accessor});`,
        context: {moment}
    };
});

registerConverterCompiler('mongo', 'class', 'uuid', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `
        try {
            //marshal-bson already returns a string for uuid
            ${setter} = 'string' === typeof ${accessor} ? ${accessor} : uuid4Stringify(${accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}: ' + error);
        }
        `,
        context: {uuid4Stringify}
    };
});

registerConverterCompiler('class', 'mongo', 'uuid', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
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

registerConverterCompiler('mongo', 'class', 'objectId', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `
    try {
        //marshal-bson already returns a string for uuid
        ${setter} = 'string' === typeof ${accessor} ? ${accessor} : ${accessor}.toHexString();
    } catch (error) {
        throw new TypeError('Invalid ObjectID given in property ${property.name}');
    }
    `;
});

registerConverterCompiler('class', 'mongo', 'objectId', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
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

registerConverterCompiler('mongo', 'class', 'class', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, context, jitStack) => {
    //when property is a reference, then we stored in the database the actual primary key and used this
    //field as foreignKey. This makes it necessary to convert it differently (concretely we treat it as the primary)
    const classSchema = getClassSchema(property.resolveClassType!);

    if (property.isReference) {
        const classType = reserveVariable();
        const primary = classSchema.getPrimaryField();

        return {
            template: getDataConverterJS(setter, accessor, primary, 'mongo', 'class', context, jitStack),
            context: {
                [classType]: property.resolveClassType,
                createClassToXFunction,
            }
        };
    }
    const xToClass = reserveVariable('xToClass');

    return {
        template: `
            ${setter} = ${xToClass}.fn(${accessor}, _options, getParents(), _state);
        `,
        context: {
            [xToClass]: jitStack.getOrCreate(classSchema, () => createXToClassFunction(classSchema, 'mongo', jitStack))
        }
    };
});

registerConverterCompiler('mongo', 'class', 'union', compilerXToUnionClass('mongo'));

registerConverterCompiler('class', 'mongo', 'class', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, context, jitStack) => {
    //When property is a reference we store the actual primary (as foreign key) of the referenced instance instead of the actual instance.
    //This way we implemented basically relations in mongodb
    const classSchema = getClassSchema(property.resolveClassType!);
    if (property.isReference) {
        const classType = reserveVariable();
        const primary = classSchema.getPrimaryField();
        const rootBootstrap = {code: ''};
        return {
            template: `
            if (${accessor} instanceof ${classType}) {
                ${getDataConverterJS(setter, `${accessor}.${primary.name}`, primary, 'class', 'mongo', context, jitStack)}
            } else {
                //we treat the input as if the user gave the primary key directly
                ${getDataConverterJS(setter, `${accessor}`, primary, 'class', 'mongo', context, jitStack)}
            }
            `,
            bootstrap: rootBootstrap.code,
            context: {
                [classType]: property.resolveClassType,
            }
        };
    }

    const classToX = reserveVariable('classToX');

    return {
        template: `${setter} = ${classToX}.fn(${accessor}, _options);`,
        context: {
            [classToX]: jitStack.getOrCreate(classSchema, () => createClassToXFunction(classSchema, 'mongo', jitStack))
        }
    };
});

const convertTypedArrayToMongo = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = new Binary(typedArrayToBuffer(${accessor}));`,
        context: {
            Binary,
            typedArrayToBuffer
        }
    };
};
registerConverterCompiler('class', 'mongo', 'Int8Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Uint8Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Uint8Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Uint8ClampedArray', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Int16Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Uint16Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Int32Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Int32Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Uint32Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Float32Array', convertTypedArrayToMongo);
registerConverterCompiler('class', 'mongo', 'Float64Array', convertTypedArrayToMongo);


const convertTypedArrayToClass = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = nodeBufferToTypedArray(${accessor}.buffer, typedArrayNamesMap.get('${property.type}'));`,
        context: {
            typedArrayNamesMap,
            nodeBufferToTypedArray
        }
    };
};
registerConverterCompiler('mongo', 'class', 'Int8Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Uint8Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Uint8Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Uint8ClampedArray', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Int16Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Uint16Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Int32Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Int32Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Uint32Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Float32Array', convertTypedArrayToClass);
registerConverterCompiler('mongo', 'class', 'Float64Array', convertTypedArrayToClass);


registerConverterCompiler('mongo', 'class', 'arrayBuffer', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = nodeBufferToArrayBuffer(${accessor}.buffer);`,
        context: {
            nodeBufferToArrayBuffer
        }
    };
});

registerConverterCompiler('class', 'mongo', 'arrayBuffer', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = new Binary(Buffer.from(${accessor}));`,
        context: {
            Buffer,
            Binary
        }
    };
});
