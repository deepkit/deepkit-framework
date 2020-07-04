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
} from "@super-hornet/marshal";
import {Binary, ObjectID} from "mongodb";
import * as mongoUuid from "mongo-uuid";

export function uuid4Binary(u?: string): Binary {
    return mongoUuid(Binary, u);
}

export function uuid4Stringify(u: Binary): string {
    return mongoUuid.stringify(u);
}

registerConverterCompiler('class', 'mongo', 'string', compilerToString);
registerConverterCompiler('mongo', 'class', 'string', compilerToString);

registerConverterCompiler('class', 'mongo', 'number', compilerToNumber);
registerConverterCompiler('mongo', 'class', 'number', compilerToNumber);

registerConverterCompiler('class', 'mongo', 'moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = ${accessor}.toDate();`
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
            ${setter} = uuid4Stringify(${accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}');
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
        ${setter} = ${accessor}.toHexString();
    } catch (error) {
        throw new TypeError('Invalid ObjectID given in property ${property.name}');
    }
    `
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

registerConverterCompiler('mongo', 'class', 'class', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, context) => {
    //when property is a reference, then we stored in the database the actual primary key and used this
    //field as foreignKey. This makes it necessary to convert it differently (concretely we treat it as the primary)
    if (property.isReference) {
        const classType = reserveVariable();
        const schema = getClassSchema(property.resolveClassType!);
        const primary = schema.getPrimaryField();

        return {
            template: getDataConverterJS(setter, accessor, primary, 'mongo', 'class', context),
            context: {
                [classType]: property.resolveClassType,
                createClassToXFunction,
            }
        }
    }
    const classType = reserveVariable();

    return {
        template: `
            ${setter} = createXToClassFunction(${classType}, 'mongo')(${accessor}, _options, getParents(), _state);
        `,
        context: {
            [classType]: property.resolveClassType,
            createXToClassFunction
        }
    };
});

registerConverterCompiler('mongo', 'class', 'union', compilerXToUnionClass('mongo'));

registerConverterCompiler('class', 'mongo', 'class', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, context) => {
    //When property is a reference we store the actual primary (as foreign key) of the referenced instance instead of the actual instance.
    //This way we implemented basically relations in mongodb
    if (property.isReference) {
        const classType = reserveVariable();
        const schema = getClassSchema(property.resolveClassType!);
        const primary = schema.getPrimaryField();
        return {
            template: `
            if (${accessor} instanceof ${classType}) {
                ${getDataConverterJS(setter, `${accessor}.${primary.name}`, primary, 'class', 'mongo', context)}
            } else {
                //we treat the input as if the user gave the primary key directly
                ${getDataConverterJS(setter, `${accessor}`, primary, 'class', 'mongo', context)}
            }
            `,
            context: {
                [classType]: property.resolveClassType,
            }
        }
    }

    const classType = reserveVariable();
    return {
        template: `${setter} = createClassToXFunction(${classType}, 'mongo')(${accessor}, _options);`,
        context: {
            [classType]: property.resolveClassType,
            createClassToXFunction,
        }
    }
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
