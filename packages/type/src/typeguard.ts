import { ReceiveType, resolveReceiveType } from './reflection/reflection';
import { createTypeGuardFunction, serializer, Serializer } from './serializer';
import { NoTypeReceived } from './utils';
import { ValidationFailedItem } from './validator';
import { getTypeJitContainer } from './reflection/type';

export function is<T>(data: any, serializerToUse: Serializer = serializer, errors: ValidationFailedItem[] = [], receiveType?: ReceiveType<T>): data is T {
    if (!receiveType) throw new NoTypeReceived();
    const type = resolveReceiveType(receiveType);
    const jit = getTypeJitContainer(type);
    if (jit.__is) return jit.__is(data, { errors }) as boolean;

    const fn = createTypeGuardFunction({
        type: type,
        registry: serializerToUse.typeGuards.getRegistry(1),
        validation: true,
        specificality: 1
    });
    if (!fn) return false;
    jit.__is = fn;
    return fn(data, { errors }) as boolean;
}
