import { ClassType, isFunction, isPlainObject } from '@deepkit/core';
import { Packed, PackStruct, ReflectionOp, unpack } from './reflection';


function hasType(o: any): o is { __type: Packed | { [name: string]: Packed } } {
    return '__type' in o && !!o.__type;
}

export enum ReflectionVisibility {
    public,
    protected,
    private,
}

export enum ReflectionKind {
    any,
    void,
    string,
    number,
    boolean,
    bigint,
    null,
    undefined,
    literal,
    property,
    method,
    function,
    promise,

    /**
     * Uint8Array, Date, custom classes, Set, Map, etc
     */
    class,

    enum,
    union,

    array,
    record,

    interface,

    partial,
    pick,
    exclude,

    typeAlias, //Partial, Pick, Exclude,
}

export interface TypeAny {
    kind: ReflectionKind.any,
}

export interface TypeVoid {
    kind: ReflectionKind.void,
}

export interface TypeString {
    kind: ReflectionKind.string,
}

export interface TypeNumber {
    kind: ReflectionKind.number,
}

export interface TypeBoolean {
    kind: ReflectionKind.boolean,
}

export interface TypeBigInt {
    kind: ReflectionKind.bigint,
}

export interface TypeNull {
    kind: ReflectionKind.null,
}

export interface TypeUndefined {
    kind: ReflectionKind.undefined,
}

export interface TypeLiteral {
    kind: ReflectionKind.literal,
    literal: string | number | boolean;
}

export interface TypeMethod {
    kind: ReflectionKind.method,
    visibility: ReflectionVisibility,
    parameters: Type[];
    abstract?: true;
    return: Type;
}

export interface TypeProperty {
    kind: ReflectionKind.property,
    visibility: ReflectionVisibility,
    optional?: true,
    abstract?: true;
    type: Type;
}

export interface TypeFunction {
    kind: ReflectionKind.function,
    parameters: Type[];
    return: Type;
}

export interface TypePromise {
    kind: ReflectionKind.promise,
    type: Type;
}

export interface TypeClass {
    kind: ReflectionKind.class,
    classType: ClassType;
    /**
     * When class has generic template arguments, e.g. MyClass<string>
     */
    types: Type[];
}

export interface TypeEnum {
    kind: ReflectionKind.enum,
    enumType: object;
}

export interface TypeUnion {
    kind: ReflectionKind.union,
    types: Type[];
}

export interface TypeArray {
    kind: ReflectionKind.array,
    elementType: Type;
}

export interface TypeRecord {
    kind: ReflectionKind.record,
    key: Type;
    value: Type;
}

export interface TypeInterface {
    kind: ReflectionKind.interface,
    //not clear yet what to expose here
}

export interface TypePartial {
    kind: ReflectionKind.partial,
    type: Type;
}

export interface TypePick {
    kind: ReflectionKind.pick,
    type: Type;
    keys: string[];
}

export interface TypeExclude {
    kind: ReflectionKind.exclude,
    type: Type;
    keys: string[];
}

export type Type = TypeAny | TypeVoid | TypeString | TypeNumber | TypeBoolean | TypeBigInt | TypeNull | TypeUndefined | TypeLiteral
    | TypeFunction | TypeMethod | TypeProperty | TypePromise | TypeClass | TypeEnum | TypeUnion | TypeArray | TypeRecord | TypeInterface
    | TypePartial | TypePick | TypeExclude;

const globalKnownStackTypes: any[] = [
    String, Number, Boolean, Date,
    Uint8Array, Uint8ClampedArray, Int8Array,
    Uint16Array, Int16Array,
    Uint32Array, Int32Array,
    Float32Array, Float64Array,
    'undefined' !== typeof BigInt64Array ? BigInt64Array : undefined,
    'undefined' !== typeof BigInt ? BigInt : undefined,
];

interface ExtractTypeStackEntry {
    op: ReflectionOp,
    type: Type,
    types: Type[],
    expectedTypes: number
}

export function extractPackStruct(pack: PackStruct, extractStackEntry: Partial<ExtractTypeStackEntry> = {}): Type {
    let stackIndex = 0;

    //we pop from the beginning, not end
    function popStack(): any {
        const item = pack.stack[stackIndex++];
        if (globalKnownStackTypes.includes(item)) return item;
        if (isFunction(item)) return item();

        return item;
    }

    let entry: ExtractTypeStackEntry = { op: ReflectionOp.any, type: { kind: ReflectionKind.void }, types: [], expectedTypes: 0, ...extractStackEntry };
    const stack: ExtractTypeStackEntry[] = [];

    function handleUp() {
        if (entry.type.kind === ReflectionKind.union) {
            entry.type.types = entry.types;
        } else if (entry.op === ReflectionOp.function || entry.op === ReflectionOp.method) {
            if (entry.type.kind === ReflectionKind.function || entry.type.kind === ReflectionKind.method) {
                if (entry.types.length > 1) {
                    entry.type.parameters = entry.types.slice(0, -1);
                }
                if (entry.types.length > 0) {
                    entry.type.return = entry.types[entry.types.length - 1];
                }
            }
        } else if (entry.op === ReflectionOp.genericClass) {
            if (entry.type.kind === ReflectionKind.class) {
                entry.type.types = entry.types;
            }
        }

        const candidate = stack.pop();
        if (!candidate) return;
        entry = candidate;
    }

    for (const op of pack.ops) {
        if (op === ReflectionOp.any) {
            entry.types.push({ kind: ReflectionKind.any });
        } else if (op === ReflectionOp.void) {
            entry.types.push({ kind: ReflectionKind.void });
        } else if (op === ReflectionOp.string) {
            entry.types.push({ kind: ReflectionKind.string });
        } else if (op === ReflectionOp.number) {
            entry.types.push({ kind: ReflectionKind.number });
        } else if (op === ReflectionOp.boolean) {
            entry.types.push({ kind: ReflectionKind.boolean });
        } else if (op === ReflectionOp.null) {
            entry.types.push({ kind: ReflectionKind.null });
        } else if (op === ReflectionOp.undefined) {
            entry.types.push({ kind: ReflectionKind.undefined });
        } else if (op === ReflectionOp.bigint) {
            entry.types.push({ kind: ReflectionKind.bigint });
        } else if (op === ReflectionOp.date) {
            entry.types.push({ kind: ReflectionKind.class, classType: Date, types: [] });
        } else if (op === ReflectionOp.uint8Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: Uint8Array, types: [] });
        } else if (op === ReflectionOp.int8Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: Int8Array, types: [] });
        } else if (op === ReflectionOp.uint8ClampedArray) {
            entry.types.push({ kind: ReflectionKind.class, classType: Uint8ClampedArray, types: [] });
        } else if (op === ReflectionOp.uint16Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: Uint16Array, types: [] });
        } else if (op === ReflectionOp.int16Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: Int16Array, types: [] });
        } else if (op === ReflectionOp.uint32Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: Uint32Array, types: [] });
        } else if (op === ReflectionOp.int32Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: Int32Array, types: [] });
        } else if (op === ReflectionOp.float32Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: Float32Array, types: [] });
        } else if (op === ReflectionOp.float64Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: Float64Array, types: [] });
        } else if (op === ReflectionOp.bigInt64Array) {
            entry.types.push({ kind: ReflectionKind.class, classType: 'undefined' !== typeof BigInt64Array ? BigInt64Array : class BigInt64ArrayNotAvailable {}, types: [] });
        } else if (op === ReflectionOp.arrayBuffer) {
            entry.types.push({ kind: ReflectionKind.class, classType: ArrayBuffer, types: [] });
        } else if (op === ReflectionOp.literal) {
            entry.types.push({ kind: ReflectionKind.literal, literal: popStack() });
        } else if (op === ReflectionOp.optional) {
            if (entry.type.kind === ReflectionKind.property) entry.type.optional = true;
        } else if (op === ReflectionOp.protected) {
            if (entry.type.kind === ReflectionKind.property || entry.type.kind === ReflectionKind.method) entry.type.visibility = ReflectionVisibility.protected;
        } else if (op === ReflectionOp.private) {
            if (entry.type.kind === ReflectionKind.property || entry.type.kind === ReflectionKind.method) entry.type.visibility = ReflectionVisibility.private;
        } else if (op === ReflectionOp.abstract) {
            if (entry.type.kind === ReflectionKind.property || entry.type.kind === ReflectionKind.method) entry.type.abstract = true;
        } else if (op === ReflectionOp.enum) {
            entry.types.push({ kind: ReflectionKind.enum, enumType: popStack() });
        } else if (op === ReflectionOp.set) {
            const type: Type = { kind: ReflectionKind.class, classType: Set, types: [] };
            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 1,
            };
        } else if (op === ReflectionOp.partial) {
            const type: Type = { kind: ReflectionKind.partial, type: {kind: ReflectionKind.any} };
            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 1,
            };
        } else if (op === ReflectionOp.map) {
            const type: Type = { kind: ReflectionKind.class, classType: Map, types: [] };
            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 2,
            };
        } else if (op === ReflectionOp.array) {
            const type: Type = { kind: ReflectionKind.array, elementType: { kind: ReflectionKind.any } };
            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 1,
            };
        } else if (op === ReflectionOp.promise) {
            const type: Type = { kind: ReflectionKind.promise, type: { kind: ReflectionKind.any } };
            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 1,
            };
        } else if (op === ReflectionOp.property) {
            const type: Type = { kind: ReflectionKind.property, visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.any } };
            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 1,
            };
        } else if (op === ReflectionOp.function || op === ReflectionOp.method) {
            const type: Type = op === ReflectionOp.function
                ? { kind: ReflectionKind.function, parameters: [], return: { kind: ReflectionKind.void } }
                : { kind: ReflectionKind.method, visibility: ReflectionVisibility.public, parameters: [], return: { kind: ReflectionKind.void } };

            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 0,
            };
        } else if (op === ReflectionOp.genericClass || op === ReflectionOp.class) {
            const type: Type = { kind: ReflectionKind.class, types: [], classType: popStack() };
            entry.types.push(type);
            if (op === ReflectionOp.genericClass) {
                //genericClass expects a ReflectionOp.up at the end
                stack.push(entry);
                entry = {
                    op,
                    type,
                    types: [],
                    expectedTypes: 0,
                };
            }
        } else if (op === ReflectionOp.union) {
            const type: Type = { kind: ReflectionKind.union, types: [] };
            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 0,
            };
        } else if (op === ReflectionOp.record) {
            const type: Type = { kind: ReflectionKind.record, key: { kind: ReflectionKind.any }, value: { kind: ReflectionKind.any } };
            entry.types.push(type);

            stack.push(entry);
            entry = {
                op,
                type,
                types: [],
                expectedTypes: 2,
            };
        } else if (op === ReflectionOp.up) {
            handleUp();
        }

        if (entry.expectedTypes > 0 && entry.types.length === entry.expectedTypes) {
            //union and genericClass have dynamic sub types, and are handled via ReflectionOp.up
            if (entry.type.kind === ReflectionKind.array) {
                entry.type.elementType = entry.types[0];
            } else if (entry.type.kind === ReflectionKind.record) {
                entry.type.key = entry.types[0];
                entry.type.value = entry.types[1];
            } else if (entry.type.kind === ReflectionKind.promise) {
                entry.type.type = entry.types[0];
            } else if (entry.type.kind === ReflectionKind.class) {
                entry.type.types = entry.types;
            } else if (entry.type.kind === ReflectionKind.property) {
                entry.type.type = entry.types[0];
            } else if (entry.type.kind === ReflectionKind.partial) {
                entry.type.type = entry.types[0];
            }
            const candidate = stack.pop();
            if (!candidate) continue;
            entry = candidate;
        }
    }

    //last ReflectionOp.up is optional
    handleUp();

    return entry.type.kind === ReflectionKind.void && entry.types.length ? entry.types[0] : entry.type;
}

export class ReflectionProperty {
    constructor(
        public classType: ClassType,
        public name: string,
        public visibility: ReflectionVisibility,
        //is set when a default value expression is given
        public defaultValueFactory?: () => any,
    ) {
    }

    hasDefaultValue(): boolean {
        return this.defaultValueFactory !== undefined;
    }

    getDefaultValue(): any {
        if (this.defaultValueFactory) return this.defaultValueFactory();
    }

    static fromPack(name: string, pack: PackStruct): ReflectionProperty {
        throw new Error;
        // for (const op of pack.ops) {
        //     // if (op === )
        // }
    }
}

export class ReflectionClass {
    protected packs: Record<string, PackStruct> = {};
    protected properties?: Record<string, ReflectionProperty> = {};

    constructor(public classType: ClassType) {
        if (hasType(classType)) {
            if (isPlainObject(classType.__type)) {
                for (const i in classType.__type) {
                    if (!classType.__type.hasOwnProperty(i)) continue;
                    this.packs[i] = unpack((classType.__type as any)[i]);
                }
            }
        }
    }

    getPropertiesMap(): Record<string, ReflectionProperty> {
        if (!this.properties) {
            this.properties = {};
            for (const i in this.packs) {
                this.properties[i] = ReflectionProperty.fromPack(i, this.packs[i]);
            }
        }
        return this.properties;
    }

    getProperties(): ReflectionProperty[] {
        return Object.values(this.getPropertiesMap());
    }

}
