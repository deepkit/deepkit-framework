import { isType, ReflectionKind, Type } from './type';

type AssignableType = Type | string | boolean | number | bigint | undefined | null;

export function isAssignable(left: AssignableType, right: AssignableType): boolean {
    const rightType = isType(right) ? right : undefined;
    const leftType = isType(left) ? left : undefined;

    if ('string' === typeof left && rightType && rightType.kind === ReflectionKind.string) return true;
    if ('number' === typeof left && rightType && rightType.kind === ReflectionKind.number) return true;
    if ('boolean' === typeof left && rightType && rightType.kind === ReflectionKind.boolean) return true;
    if ('bigint' === typeof left && rightType && rightType.kind === ReflectionKind.bigint) return true;
    if ('undefined' === typeof left && rightType && rightType.kind === ReflectionKind.bigint) return true;

    if (rightType && rightType.kind === ReflectionKind.literal && ReflectionKind.literal === left) return true;

    if (leftType && rightType && leftType.kind === rightType.kind &&
        (
            leftType.kind === ReflectionKind.string || leftType.kind === ReflectionKind.number || leftType.kind === ReflectionKind.boolean ||
            leftType.kind === ReflectionKind.bigint || leftType.kind === ReflectionKind.undefined || leftType.kind === ReflectionKind.any ||
            leftType.kind === ReflectionKind.null || leftType.kind === ReflectionKind.void
        )
    ) {
        return true;
    }

    if (rightType && rightType.kind === ReflectionKind.union) return rightType.types.some(v => isAssignable(left, v));

    return false;
}
