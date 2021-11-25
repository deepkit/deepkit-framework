import { ReceiveType } from './reflection/reflection';
import { createTypeGuardFunction, serializer, Serializer } from './serializer';
import { resolvePacked } from './reflection/processor';


export function is<T>(data: any, type?: ReceiveType<T>, serializerToUse: Serializer = serializer): data is T {
    if (type!.__is) return type!.__is(data);
    const fn = createTypeGuardFunction(resolvePacked(type!), serializerToUse.typeGuards.getRegistry(1), undefined, 1);
    if (!fn) return false;
    type!.__is = fn;
    return fn(data) as boolean;
}
