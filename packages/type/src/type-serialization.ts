import { Type } from "./reflection/type";

export interface SerializedType {
    refs: Type[];
}

/**
 * Converts a (possibly circular/nested) type into a JSON.stringify'able structure suited to be transmitted over the wire and deserialized back to the correct Type object.
 */
export function serializeType(type: Type): SerializedType {
    //todo: implement that for RPC
}

export function deserializeType(type: SerializedType): Type {

}
