import { isSameType, reflect, ReflectionKind, Type, TypeClass, TypeObjectLiteral } from '@deepkit/type';
import { getParentClass } from '@deepkit/core';

export type InjectMeta<T = never> = { __meta?: never & ['inject', T] }
export type Inject<Type, Token = never> = Type & InjectMeta<Token>

/**
 * Checks if given type is nominally compatible with the given interface.
 *
 * @example
 * ```typescript
 * class A {
 * }
 *
 * class B extends A {
 * }
 *
 * interface B0 extends B {}
 *
 * class C {
 * }
 *
 * nominalCompatibility(A, A) // true
 * nominalCompatibility(A, B) // true
 * nominalCompatibility(A, B0) // true
 * nominalCompatibility(A, C) // false
 */
export function nominalCompatibility(token: Type, provider: TypeClass | TypeObjectLiteral): boolean {
    //we want to check if the token is nominal the same with the provider.
    if (token === provider) return true;

    if (token.kind === ReflectionKind.class && provider.kind === ReflectionKind.class && token.classType === provider.classType) return true;

    const stack: Type[] = [provider];
    while (stack.length) {
        const current = stack.pop()!;
        if (current.kind !== ReflectionKind.class && current.kind !== ReflectionKind.objectLiteral) continue;
        if (current.kind === ReflectionKind.class) {
            if (token.kind === ReflectionKind.class && current.classType === token.classType) return true;
            const parent = getParentClass(current.classType);
            if (parent && (parent as any).__type) {
                const next = reflect(parent);
                stack.push(next);
            }
        } else if (current.kind === ReflectionKind.objectLiteral) {
            if (token.kind === ReflectionKind.objectLiteral) {
                if (current.id && current.id === token.id) return true;
            }
        }

        if (current.implements) {
            for (const i of current.implements) {
                stack.push(i);
            }
        }
    }


    return false;
}
