import { ReceiveType } from './reflection/reflection';
import { createTypeGuardFunction, serializer, Serializer } from './serializer';
import { resolvePacked } from './reflection/processor';

export function is<T>(data: any, type?: ReceiveType<T>, serializerToUse: Serializer = serializer): data is T {
    const fn = createTypeGuardFunction(resolvePacked(type!), serializerToUse.typeGuards);
    return fn(data) as boolean;
}
