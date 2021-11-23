import { ReflectionKind, TypeClass, TypeNumberBrand } from './reflection/type';
import { serializeArray, Serializer, TemplateState } from './serializer';


/**
 * Set is simply serialized as array.
 */
function deserializeTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    state.setContext({ Array });
    serializeArray(type.arguments[0], state);
    state.addSetter(`new Set(${state.accessor})`);
}

/**
 * Set is simply serialized as array.
 */
function serializeTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    state.setContext({ Array });
    state.addSetter(`Array.from(${state.accessor})`);

    serializeArray(type.arguments[0], state);
}

function deserializeTypeClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;
    state.setContext({ Array });
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

    state.setContext({ Array });
    state.addSetter(`Array.from(${state.accessor})`);

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

        this.serializeRegistry.prependClass(Set, serializeTypeClassSet);
        this.serializeRegistry.prependClass(Map, serializeTypeClassMap);

        this.deserializeRegistry.prependClass(Set, deserializeTypeClassSet);
        this.deserializeRegistry.prependClass(Map, deserializeTypeClassMap);

        this.serializeRegistry.prependClass(Date, (type, state) => {
            state.addSetter(`${state.accessor}.toJSON()`);
        });

        this.deserializeRegistry.prependClass(Date, (type, state) => {
            state.setContext({ Date });
            state.addSetter(`new Date(${state.accessor})`);
        });
    }
}

export const jsonSerializer = new JSONSerializer;

