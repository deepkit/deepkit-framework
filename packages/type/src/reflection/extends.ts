/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { isType, ReflectionKind, Type, typeInfer } from './type';

type AssignableType = Type | string | boolean | number | symbol | bigint | undefined | null;

/**
 * The check of `extends` in Typescript. This function can be read as `left extends right`.
 *
 * See https://www.typescriptlang.org/docs/handbook/type-compatibility.html#any-unknown-object-void-undefined-null-and-never-assignability
 * This algo follows strict mode.
 */
export function isExtendable(leftValue: AssignableType, rightValue: AssignableType): boolean {
    const right: Type = isType(rightValue) ? rightValue : typeInfer(rightValue);
    const left: Type = isType(leftValue) ? leftValue : typeInfer(leftValue);

    if (right.kind !== ReflectionKind.union) {
        if (left.kind === ReflectionKind.null) {
            return right.kind === ReflectionKind.any || right.kind === ReflectionKind.unknown || right.kind === ReflectionKind.null;
        }

        if (left.kind === ReflectionKind.undefined) {
            return right.kind === ReflectionKind.any || right.kind === ReflectionKind.unknown || right.kind === ReflectionKind.void || right.kind === ReflectionKind.undefined;
        }

        if (left.kind === ReflectionKind.void) {
            return right.kind === ReflectionKind.any || right.kind === ReflectionKind.unknown || right.kind === ReflectionKind.void;
        }

        if (left.kind === ReflectionKind.unknown) {
            return right.kind === ReflectionKind.any || right.kind === ReflectionKind.unknown;
        }

        if (left.kind === ReflectionKind.any) {
            return right.kind !== ReflectionKind.never;
        }

        if (left.kind === ReflectionKind.object) {
            return right.kind === ReflectionKind.any || right.kind === ReflectionKind.unknown || right.kind === ReflectionKind.object
                || (right.kind === ReflectionKind.objectLiteral && right.types.length === 0)
                || (right.kind === ReflectionKind.class && right.types.length === 0);
        }

        if (left.kind === ReflectionKind.objectLiteral && left.types.length === 0) {
            return right.kind === ReflectionKind.any || right.kind === ReflectionKind.unknown || right.kind === ReflectionKind.object
                || (right.kind === ReflectionKind.objectLiteral && right.types.length === 0)
                || (right.kind === ReflectionKind.class && right.types.length === 0);
        }
    }

    if (left.kind === ReflectionKind.never) return true;
    if (right.kind === ReflectionKind.never) return false;

    if (left.kind === ReflectionKind.literal && right.kind === ReflectionKind.literal) return left.literal === right.literal;
    if (left.kind === ReflectionKind.string && right.kind === ReflectionKind.string) return true;
    if (left.kind === ReflectionKind.number && right.kind === ReflectionKind.number) return true;
    if (left.kind === ReflectionKind.boolean && right.kind === ReflectionKind.boolean) return true;
    if (left.kind === ReflectionKind.bigint && right.kind === ReflectionKind.bigint) return true;
    if (left.kind === ReflectionKind.symbol && right.kind === ReflectionKind.symbol) return true;

    if (left.kind === ReflectionKind.literal) {
        if ('string' === typeof left.literal && right.kind === ReflectionKind.string) return true;
        if ('number' === typeof left.literal && right.kind === ReflectionKind.number) return true;
        if ('boolean' === typeof left.literal && right.kind === ReflectionKind.boolean) return true;
        if ('bigint' === typeof left.literal && right.kind === ReflectionKind.bigint) return true;
        if ('symbol' === typeof left.literal && right.kind === ReflectionKind.symbol) return true;
    }

    if (left.kind === ReflectionKind.infer) {
        left.set(right);
        return true;
    }

    if (right.kind === ReflectionKind.infer) {
        right.set(left);
        return true;
    }

    if ((left.kind === ReflectionKind.function || left.kind === ReflectionKind.method || left.kind === ReflectionKind.methodSignature) &&
        (right.kind === ReflectionKind.function || right.kind === ReflectionKind.method || right.kind === ReflectionKind.methodSignature || right.kind === ReflectionKind.objectLiteral)
    ) {
        if (right.kind === ReflectionKind.objectLiteral) {
            //todo: members maybe contain a call signature

            return true;
        }

        if (right.kind === ReflectionKind.function || right.kind === ReflectionKind.methodSignature || right.kind === ReflectionKind.method) {
            const returnValid = isExtendable(left.return, right.return);
            if (!returnValid) return false;

            for (let i = 0; i < left.parameters.length; i++) {
                const leftParam = left.parameters[i];
                const rightParam = right.parameters[i];
                if (!rightParam) return false;
                if (leftParam.kind !== ReflectionKind.parameter || rightParam.kind !== ReflectionKind.parameter) return false;

                const valid = isExtendable(leftParam.type, rightParam.type);
                if (!valid) return false;
            }

            return true;
        }

        return false;
    }

    if (left.kind === ReflectionKind.propertySignature && right.kind === ReflectionKind.propertySignature) {
        return isExtendable(left.type, right.type);
    }

    if (left.kind === ReflectionKind.objectLiteral && right.kind === ReflectionKind.objectLiteral) {

        //{a: number} extends {a: number, b: string}
        for (const member of left.types) {
            //todo: call signature
            //todo: index signatures

            if (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.methodSignature) {
                const rightMember = right.types.find(v => (v.kind === ReflectionKind.propertySignature || v.kind === ReflectionKind.methodSignature) && v.name === member.name);
                if (!rightMember) return false;
                if (!isExtendable(member, rightMember)) return false;
            }
        }
        return true;
    }

    if (left.kind === ReflectionKind.array && right.kind === ReflectionKind.array) {
        return isExtendable(left.type, right.type);
    }

    if (left.kind === ReflectionKind.tuple && right.kind === ReflectionKind.array) {
        //todo: tuple can be compatible to array, e.g. [string] extends string[], [string, number] extends (string|number)[],
        // [...string] extends string[] or [number, ...string] extends (number|string)[]
    }

    if (left.kind === ReflectionKind.array && right.kind === ReflectionKind.tuple) {
        //todo: array can be compatible to tuple, e.g. string[] extends [...string], (number|string)[] extends [number, ...string]
    }

    if (left.kind === ReflectionKind.tuple && right.kind === ReflectionKind.tuple) {
        //todo: this check is actually much more complicated when ReflectionKind.rest is involved
        for (let i = 0; i < left.types.length; i++) {
            const subLeftType = left.types[i];
            const subRightType = right.types[i];
            const valid = isExtendable(subLeftType.type, subRightType.type);
            if (!valid) return false;
        }
        return true;
    }

    if (left && left.kind === ReflectionKind.union) return left.types.every(v => isExtendable(v, rightValue));

    if (right.kind === ReflectionKind.union) return right.types.some(v => isExtendable(leftValue, v));

    return false;
}
