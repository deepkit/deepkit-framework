import { ReceiveType, resolveReceiveType } from './reflection/reflection';
import { createTypeGuardFunction, Guard, serializer, Serializer } from './serializer';
import { NoTypeReceived } from './utils';
import { ValidationError, ValidationFailedItem } from './validator';
import { getTypeJitContainer } from './reflection/type';

/**
 * ```typescript
 * const validator = getValidatorFunction<MyType>();
 *
 * const errors: ValidationFailedItem[] = [];
 * const valid = validator(data, {errors})
 *
 * if (errors.length) console.log(errors); //validation failed if not empty
 * ```
 */
export function getValidatorFunction<T>(serializerToUse: Serializer = serializer, receiveType?: ReceiveType<T>): Guard {
    if (!receiveType) throw new NoTypeReceived();
    const type = resolveReceiveType(receiveType);
    const jit = getTypeJitContainer(type);
    if (jit.__is) {
        return jit.__is;
    }
    const fn = createTypeGuardFunction(type, undefined, serializerToUse) || (() => undefined);
    jit.__is = fn;
    return fn as Guard;
}

export function is<T>(data: any, serializerToUse: Serializer = serializer, errors: ValidationFailedItem[] = [], receiveType?: ReceiveType<T>): data is T {
    return getValidatorFunction(serializerToUse, receiveType)(data, { errors }) as boolean;
}

export function assert<T>(data: any, serializerToUse: Serializer = serializer, receiveType?: ReceiveType<T>): asserts data is T {
    const errors: ValidationFailedItem[] = [];
    is(data, serializerToUse, errors, receiveType);
    if (errors.length) {
        throw new ValidationError(errors, resolveReceiveType(receiveType));
    }
}
