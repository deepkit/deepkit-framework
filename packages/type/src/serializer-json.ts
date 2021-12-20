import { ReflectionKind, TypeClass } from './reflection/type';
import { serializeArray, Serializer, TemplateState } from './serializer';


/**
 * Set is simply serialized as array.
 */
function deserializeTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    serializeArray(type.arguments[0], state);
    state.addSetter(`new Set(${state.accessor})`);
}

/**
 * Set is simply serialized as array.
 */
function serializeTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    serializeArray(type.arguments[0], state);
}

function deserializeTypeClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;
    serializeArray({
        kind: ReflectionKind.tuple, types: [
            { kind: ReflectionKind.tupleMember, type: type.arguments[0] },
            { kind: ReflectionKind.tupleMember, type: type.arguments[1] },
        ]
    }, state);
    state.addSetter(`new Map(${state.accessor})`);
}

/**
 * Map is simply serialized as array of tuples.
 */
function serializeTypeClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;

    serializeArray({
        kind: ReflectionKind.tuple, types: [
            { kind: ReflectionKind.tupleMember, type: type.arguments[0] },
            { kind: ReflectionKind.tupleMember, type: type.arguments[1] },
        ]
    }, state);
}

class JSONSerializer extends Serializer {
    constructor() {
        super();

        this.serializeRegistry.registerClass(Set, serializeTypeClassSet);
        this.serializeRegistry.registerClass(Map, serializeTypeClassMap);

        this.deserializeRegistry.registerClass(Set, deserializeTypeClassSet);
        this.deserializeRegistry.registerClass(Map, deserializeTypeClassMap);
    }
}

export const jsonSerializer = new JSONSerializer;

