/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { isType, ReflectionKind, Type } from './type';

type AssignableType = Type | string | boolean | number | symbol | bigint | undefined | null;

export function isExtendable(left: AssignableType, right: AssignableType): boolean {
    const rightType = isType(right) ? right : undefined;
    const leftType = isType(left) ? left : undefined;

    if (leftType && leftType.kind === ReflectionKind.literal) {
        left = leftType.literal;
    }

    if (leftType && leftType.kind === ReflectionKind.any) return true;
    if (rightType && rightType.kind === ReflectionKind.any) return true;

    if ('string' === typeof left && rightType && rightType.kind === ReflectionKind.string) return true;
    if ('number' === typeof left && rightType && rightType.kind === ReflectionKind.number) return true;
    if ('boolean' === typeof left && rightType && rightType.kind === ReflectionKind.boolean) return true;
    if ('bigint' === typeof left && rightType && rightType.kind === ReflectionKind.bigint) return true;
    if ('undefined' === typeof left && rightType && rightType.kind === ReflectionKind.bigint) return true;

    if (rightType && rightType.kind === ReflectionKind.literal && ReflectionKind.literal === left) return true;

    if (leftType && rightType) {
        if (leftType.kind === ReflectionKind.infer) {
            leftType.set(rightType);
            return true;
        }

        if (rightType.kind === ReflectionKind.infer) {
            rightType.set(leftType);
            return true;
        }

        if (leftType.kind === ReflectionKind.function && rightType) {
            if (rightType.kind === ReflectionKind.objectLiteral) {
                //todo: members maybe contain a call signature

                return true;
            }

            if (rightType.kind === ReflectionKind.function) {
                const returnValid = isExtendable(leftType.return, rightType.return);
                if (!returnValid) return false;

                for (let i = 0; i < leftType.parameters.length; i++) {
                    const leftParam = leftType.parameters[i];
                    const rightParam = rightType.parameters[i];
                    if (!rightParam) return false;
                    if (leftParam.kind !== ReflectionKind.parameter || rightParam.kind !== ReflectionKind.parameter) return false;

                    const valid = isExtendable(leftParam.type, rightParam.type);
                    if (!valid) return false;
                }

                return true;
            }

            return false;
        }

        if (leftType.kind === ReflectionKind.propertySignature && rightType.kind === ReflectionKind.propertySignature) {
            return isExtendable(leftType.type, rightType.type);
        }

        if (leftType.kind === rightType.kind &&
            (
                leftType.kind === ReflectionKind.string || leftType.kind === ReflectionKind.number || leftType.kind === ReflectionKind.boolean ||
                leftType.kind === ReflectionKind.bigint || leftType.kind === ReflectionKind.undefined ||
                leftType.kind === ReflectionKind.null || leftType.kind === ReflectionKind.void
            )
        ) {
            return true;
        }

        //todo object literal/class
        if (leftType.kind === ReflectionKind.objectLiteral) {
            if (rightType.kind !== ReflectionKind.objectLiteral) return false;

            //{a: number} extends {a: number, b: string}
            for (const member of leftType.types) {
                if (member.kind === ReflectionKind.propertySignature) {
                    const rightMember = rightType.types.find(v => v.kind === ReflectionKind.propertySignature && v.name === member.name);
                    if (!rightMember) return false;
                    if (!isExtendable(member, rightMember)) return false;
                }
            }
            return true;
        }

    }

    if (rightType && rightType.kind === ReflectionKind.union) return rightType.types.some(v => isExtendable(left, v));

    return false;
}
