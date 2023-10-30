/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';
import { expect, test } from '@jest/globals';
import { t } from '../src/decorator.js';
import { ReflectionClass, typeOf } from '../src/reflection/reflection.js';
import { ReflectionKind, TypeClass, TypeMethod } from '../src/reflection/type.js';
import { resolveRuntimeType } from '../src/reflection/processor.js';

test('class typeName with extends', () => {
    class BaseResponse<T> {
        constructor(public response: T) {
        }
    }

    class SubResponse extends BaseResponse<string> {
    }

    const type = typeOf<SubResponse>();
    const reflection = ReflectionClass.from(SubResponse);
    expect(reflection.getName()).toBe('SubResponse');
    expect(reflection.getSuperReflectionClass()!.getName()).toBe('BaseResponse');
    expect(reflection.getSuperReflectionClass()!.type.typeArguments![0].kind).toBe(ReflectionKind.string);
});

test('constructor parameter t.type', () => {
    class Response {
        constructor(public success: boolean) {
        }
    }

    class StreamApiResponseClass<T> {
        constructor(public response: T) {
        }
    }

    // {
    //     const reflection = reflect(StreamApiResponseClass);
    //     assertType(reflection, ReflectionKind.class);
    //
    //     // type T = StreamApiResponseClass;
    //     // type a = T['response'];
    //     //if there is no type passed to T it resolved to any
    //     expect(reflection.typeArguments).toEqual([{ kind: ReflectionKind.any }]);
    // }
    //
    // {
    //     class StreamApiResponseClassWithDefault<T = string> {
    //         constructor(public response: T) {
    //         }
    //     }
    //
    //     const reflection = reflect(StreamApiResponseClassWithDefault);
    //     assertType(reflection, ReflectionKind.class);
    //
    //     // type T = StreamApiResponseClassWithDefault;
    //     // type a = T['response'];
    //     expect(reflection.typeArguments).toMatchObject([{ kind: ReflectionKind.string }]);
    // }
    //
    // expectEqualType(typeOf<Response>(), {
    //     kind: ReflectionKind.class,
    //     classType: Response,
    //     types: [
    //         {
    //             kind: ReflectionKind.method, name: 'constructor', visibility: ReflectionVisibility.public, parameters: [
    //                 { kind: ReflectionKind.parameter, name: 'success', visibility: ReflectionVisibility.public, type: { kind: ReflectionKind.boolean } }
    //             ], return: { kind: ReflectionKind.any }
    //         },
    //         {
    //             kind: ReflectionKind.property, visibility: ReflectionVisibility.public, name: 'success', type: { kind: ReflectionKind.boolean }
    //         }
    //     ]
    // } as Type);

    function StreamApiResponse<T>(responseBodyClass: ClassType<T>) {
        class A extends StreamApiResponseClass<T> {
            constructor(@t.type(responseBodyClass) public response: T) {
                super(response);
            }
        }
        console.log('A', A);

        return A;
    }

    {
        const classType = StreamApiResponse(Response);
        const reflection = ReflectionClass.from(classType);
        expect(reflection.getMethods().length).toBe(1);
        expect(reflection.getProperties().length).toBe(1);
        expect(reflection.getMethod('constructor')!.getParameters().length).toBe(1);
        //if this fails, ClassType can probably not be resolved, which means @deepkit/core wasn't built correctly
        expect(reflection.getMethod('constructor')!.getParameter('response')!.getType().kind).toBe(ReflectionKind.class);
        expect(reflection.getMethods()[0].getName()).toBe('constructor');
        const responseType = reflection.getProperty('response')!.getType();
        expect(responseType.kind).toBe(ReflectionKind.class);
        if (responseType.kind === ReflectionKind.class) {
            expect(responseType.classType).toBe(Response);
        }
    }

    function StreamApiResponse2<T>(responseBodyClass: ClassType<T>) {
        if (!responseBodyClass) throw new Error();

        class A extends StreamApiResponseClass<T> {
            constructor(public response: T) {
                super(response);
            }
        }

        return A;
    }

    {
        const classType = StreamApiResponse2(Response);
        const type = resolveRuntimeType(classType) as TypeClass;
        expect((type.types[0] as TypeMethod).parameters[0].type.kind).toBe(ReflectionKind.class);
        const reflection = ReflectionClass.from(classType);
        expect(reflection.getMethods().length).toBe(1);
        expect(reflection.getProperties().length).toBe(1);
        expect(reflection.getMethod('constructor').getParameters().length).toBe(1);
        expect(reflection.getMethod('constructor').getParameter('response').getType().kind).toBe(ReflectionKind.class);
        expect(reflection.getMethods()[0].getName()).toBe('constructor');
        //make sure parent's T is correctly set
        const parent = reflection.getSuperReflectionClass()!.type;
        expect(parent.typeArguments![0].kind).toBe(ReflectionKind.class);

        const responseType = reflection.getProperty('response')!.getType();
        expect(responseType.kind).toBe(ReflectionKind.class);
        if (responseType.kind === ReflectionKind.class) {
            expect(responseType.classType).toBe(Response);
        }
    }

    {
        const type = typeOf<StreamApiResponseClass<Response>>() as TypeClass;
        const reflection = ReflectionClass.from(type);
        if (type.kind === ReflectionKind.class) {
            const t1 = type.arguments![0] as TypeClass;
            expect(t1.kind).toBe(ReflectionKind.class);
            expect(t1.classType).toBe(Response);
        }
        expect(reflection.getMethods().length).toBe(1);
        expect(reflection.getProperties().length).toBe(1);
        expect(reflection.getMethod('constructor').getParameters().length).toBe(1);
        expect(reflection.getMethod('constructor').getParameter('response').getType().kind).toBe(ReflectionKind.class);
        const responseType = reflection.getProperty('response')!.getType();
        expect(responseType.kind).toBe(ReflectionKind.class);
        if (responseType.kind === ReflectionKind.class) {
            expect(responseType.classType).toBe(Response);
        }

        expect(reflection.getMethods()[0].getName()).toBe('constructor');
    }
});
