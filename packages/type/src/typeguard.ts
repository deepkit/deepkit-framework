import { ReceiveType } from './reflection/reflection';
import { createTypeGuardFunction, serializer, Serializer } from './serializer';
import { resolvePacked } from './reflection/processor';
import { NoTypeReceived } from './utils';
import { ValidationFailedItem } from './validator';


export function is<T>(data: any, serializerToUse: Serializer = serializer, errors: ValidationFailedItem[] = [], type?: ReceiveType<T>): data is T {
    if (!type) throw new NoTypeReceived();
    if (type.__is) return type.__is(data);
    const fn = createTypeGuardFunction({
        type: resolvePacked(type),
        registry: serializerToUse.typeGuards.getRegistry(1),
        validation: true,
        specificality: 1
    });
    if (!fn) return false;
    type.__is = fn;
    return fn(data, { errors }) as boolean;
}
