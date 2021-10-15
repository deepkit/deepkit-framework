/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { MappedModifier, Packed, ReflectionOp, RuntimeStackEntry, unpack } from './compiler';
import {
    isType,
    ReflectionKind,
    ReflectionVisibility,
    Type,
    TypeIndexSignature,
    TypeInfer,
    TypeLiteral,
    TypeLiteralMember,
    TypeMethod,
    TypeMethodSignature,
    TypeProperty,
    TypePropertySignature,
    TypeUnion
} from './type';
import { isExtendable } from './extends';


type StackEntry = RuntimeStackEntry | Type;

function newArray<T>(init: T, items: number): T[] {
    const a: T[] = [];
    for (let i = 0; i < items; i++) {
        a.push(init);
    }
    return a;
}

export function resolveRuntimeType(o: any, args: any[] = []): Type {
    if ('__type' in o) {
        const pack = unpack(o.__type);
        const processor = new Processor();
        // debugPackStruct(pack);
        const type = processor.run(pack.ops, pack.stack, args);
        if (type.kind === ReflectionKind.class) {
            type.classType = o;
        }
        return type;
    }
    throw new Error('No valid runtime type given');
}

interface Frame {
    startIndex: number; //when the frame started, index of the stack
    variables: number;
    inputs: RuntimeStackEntry[];
    previous?: Frame;
    mappedType?: MappedType;
}

class MappedType {
    private members: Type[] = [];
    private i: number = 0;

    constructor(private fromType: Type) {
        if (fromType.kind === ReflectionKind.union) {
            this.members = fromType.members;
        }
    }

    next(): Type | undefined {
        return this.members[this.i++];
    }
}

export class Processor {
    stack: (RuntimeStackEntry | Type)[] = newArray({ kind: ReflectionKind.any }, 128);
    stackPointer = -1; //pointer to the stack
    frame: Frame = { startIndex: -1, inputs: [], variables: 0 };
    program: number = 0;

    run(ops: ReflectionOp[], initialStack: RuntimeStackEntry[], initialInputs: RuntimeStackEntry[] = []) {
        // if (ops.length === 1 && ops[0] === ReflectionOp.string) return { kind: ReflectionKind.string };

        for (let i = 0; i < initialStack.length; i++) {
            this.stack[i] = initialStack[i];
        }

        this.stackPointer = initialStack.length - 1;
        this.frame.startIndex = this.stackPointer;
        this.frame.previous = undefined;
        this.frame.variables = 0;
        this.frame.inputs = initialInputs;

        const s = ops.length;
        for (this.program = 0; this.program < s; this.program++) {
            const op = ops[this.program];
            switch (op) {
                case ReflectionOp.string:
                    this.pushType({ kind: ReflectionKind.string });
                    break;
                case ReflectionOp.number:
                    this.pushType({ kind: ReflectionKind.number });
                    break;
                case ReflectionOp.boolean:
                    this.pushType({ kind: ReflectionKind.boolean });
                    break;
                case ReflectionOp.void:
                    this.pushType({ kind: ReflectionKind.void });
                    break;
                case ReflectionOp.never:
                    this.pushType({ kind: ReflectionKind.never });
                    break;
                case ReflectionOp.undefined:
                    this.pushType({ kind: ReflectionKind.undefined });
                    break;
                case ReflectionOp.bigint:
                    this.pushType({ kind: ReflectionKind.bigint });
                    break;
                case ReflectionOp.null:
                    this.pushType({ kind: ReflectionKind.null });
                    break;
                case ReflectionOp.any:
                    this.pushType({ kind: ReflectionKind.any });
                    break;
                case ReflectionOp.literal: {
                    const ref = this.eatParameter(ops) as number;
                    this.pushType({ kind: ReflectionKind.literal, literal: initialStack[ref] as string | number | boolean | bigint });
                    break;
                }
                case ReflectionOp.date:
                    this.pushType({ kind: ReflectionKind.class, classType: Date, members: [] });
                    break;
                case ReflectionOp.uint8Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Uint8Array, members: [] });
                    break;
                case ReflectionOp.int8Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Int8Array, members: [] });
                    break;
                case ReflectionOp.uint8ClampedArray:
                    this.pushType({ kind: ReflectionKind.class, classType: Uint8ClampedArray, members: [] });
                    break;
                case ReflectionOp.uint16Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Uint16Array, members: [] });
                    break;
                case ReflectionOp.int16Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Int16Array, members: [] });
                    break;
                case ReflectionOp.uint32Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Uint32Array, members: [] });
                    break;
                case ReflectionOp.int32Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Int32Array, members: [] });
                    break;
                case ReflectionOp.float32Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Float32Array, members: [] });
                    break;
                case ReflectionOp.float64Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Float64Array, members: [] });
                    break;
                case ReflectionOp.bigInt64Array:
                    this.pushType({
                        kind: ReflectionKind.class,
                        classType: 'undefined' !== typeof BigInt64Array ? BigInt64Array : class BigInt64ArrayNotAvailable {},
                        members: []
                    });
                    break;
                case ReflectionOp.arrayBuffer:
                    this.pushType({ kind: ReflectionKind.class, classType: ArrayBuffer, members: [] });
                    break;
                case ReflectionOp.class: {
                    this.pushType({ kind: ReflectionKind.class, classType: Object, members: this.popFrame() as Type[] });
                    break;
                }
                case ReflectionOp.classReference: {
                    const ref = this.eatParameter(ops) as number;
                    const classType = (initialStack[ref] as Function)();
                    const args = this.popFrame() as Type[];
                    this.pushType(resolveRuntimeType(classType, args));
                    break;
                }
                case ReflectionOp.enum: {
                    const ref = this.eatParameter(ops) as number;
                    this.pushType({ kind: ReflectionKind.enum, enumType: (initialStack[ref] as Function)() });
                    break;
                }
                case ReflectionOp.template: {
                    const nameRef = this.eatParameter(ops) as number;
                    const type = this.frame.inputs[this.frame.variables++];

                    if (type === undefined) {
                        //generic not instantiated
                        this.pushType({ kind: ReflectionKind.template, name: initialStack[nameRef] as string });
                    } else {
                        this.pushType(type as Type);
                    }
                    break;
                }
                case ReflectionOp.set:
                    this.pushType({ kind: ReflectionKind.class, classType: Set, types: [this.pop() as Type], members: [] });
                    break;
                case ReflectionOp.map:
                    const value = this.pop() as Type;
                    const key = this.pop() as Type;
                    this.pushType({ kind: ReflectionKind.class, classType: Map, types: [key, value], members: [] });
                    break;
                case ReflectionOp.promise:
                    this.pushType({ kind: ReflectionKind.promise, type: this.pop() as Type });
                    break;
                case ReflectionOp.union: {
                    const members = this.popFrame() as Type[];
                    this.pushType({ kind: ReflectionKind.union, members });
                    break;
                }
                case ReflectionOp.function: {
                    const types = this.popFrame() as Type[];
                    const name = initialStack[this.eatParameter(ops) as number] as string;
                    this.pushType({
                        kind: ReflectionKind.function,
                        name: name || undefined,
                        return: types.length > 0 ? types[types.length - 1] : { kind: ReflectionKind.any },
                        parameters: types.length > 1 ? types.slice(0, -1) : []
                    });
                    break;
                }
                case ReflectionOp.array:
                    this.pushType({ kind: ReflectionKind.array, elementType: this.pop() as Type });
                    break;
                case ReflectionOp.property: {
                    const name = initialStack[this.eatParameter(ops) as number] as number | string | symbol;
                    this.pushType({ kind: ReflectionKind.property, type: this.pop() as Type, visibility: ReflectionVisibility.public, name });
                    break;
                }
                case ReflectionOp.propertySignature: {
                    const name = initialStack[this.eatParameter(ops) as number] as number | string | symbol;
                    this.pushType({ kind: ReflectionKind.propertySignature, type: this.pop() as Type, name });
                    break;
                }
                case ReflectionOp.method:
                case ReflectionOp.methodSignature: {
                    const name = initialStack[this.eatParameter(ops) as number] as number | string | symbol;
                    const types = this.popFrame() as Type[];
                    const returnType: Type = types.length > 0 ? types[types.length - 1] : { kind: ReflectionKind.any };
                    const parameters = types.length > 1 ? types.slice(0, -1) : [];

                    if (op === ReflectionOp.method) {
                        this.pushType({ kind: ReflectionKind.method, visibility: ReflectionVisibility.public, name, return: returnType, parameters });
                    } else {
                        this.pushType({ kind: ReflectionKind.methodSignature, name, return: returnType, parameters });
                    }
                    break;
                }
                case ReflectionOp.optional:
                    (this.stack[this.stackPointer] as TypeLiteralMember).optional = true;
                    break;
                case ReflectionOp.readonly:
                    (this.stack[this.stackPointer] as TypeLiteralMember).readonly = true;
                    break;
                case ReflectionOp.protected:
                    (this.stack[this.stackPointer] as TypeLiteralMember).visibility = ReflectionVisibility.protected;
                    break;
                case ReflectionOp.private:
                    (this.stack[this.stackPointer] as TypeLiteralMember).visibility = ReflectionVisibility.private;
                    break;
                case ReflectionOp.abstract:
                    (this.stack[this.stackPointer] as TypeLiteralMember).abstract = true;
                    break;
                case ReflectionOp.indexSignature: {
                    const type = this.pop() as Type;
                    const index = this.pop() as Type;
                    this.pushType({
                        kind: ReflectionKind.indexSignature,
                        index, type
                    });
                    break;
                }
                case ReflectionOp.objectLiteral: {
                    const members = this.popFrame() as (TypeIndexSignature | TypePropertySignature | TypeMethodSignature)[];
                    this.pushType({
                        kind: ReflectionKind.objectLiteral,
                        members
                    });
                    break;
                }
                case ReflectionOp.pointer: {
                    this.push(initialStack[this.eatParameter(ops) as number]);
                    break;
                }
                case ReflectionOp.condition: {
                    const right = this.pop() as Type;
                    const left = this.pop() as Type;
                    const condition = this.pop() as number | boolean;
                    this.popFrame();
                    condition ? this.pushType(left) : this.pushType(right);
                    break;
                }
                case ReflectionOp.jumpCondition: {
                    const leftProgram = this.eatParameter(ops) as number;
                    const rightProgram = this.eatParameter(ops) as number;
                    const condition = this.pop() as number | boolean;
                    this.call();
                    if (condition) {
                        this.program = leftProgram - 1; //-1 because next iteration does program++
                    } else {
                        this.program = rightProgram - 1; //-1 because next iteration does program++
                    }
                    break;
                }
                case ReflectionOp.infer: {
                    const frameOffset = this.eatParameter(ops) as number;
                    const stackEntryIndex = this.eatParameter(ops) as number;
                    const frame = this.frame;
                    this.push({
                        kind: ReflectionKind.infer, set: (type: Type) => {
                            if (frameOffset === 0) {
                                this.stack[frame.startIndex + 1 + stackEntryIndex] = type;
                            } else if (frameOffset === 1) {
                                this.stack[frame.previous!.startIndex + 1 + stackEntryIndex] = type;
                            } else if (frameOffset === 2) {
                                this.stack[frame.previous!.previous!.startIndex + 1 + stackEntryIndex] = type;
                            }
                        }
                    } as TypeInfer);
                    break;
                }
                case ReflectionOp.extends: {
                    const right = this.pop() as string | number | boolean | Type;
                    const left = this.pop() as string | number | boolean | Type;
                    this.push(isExtendable(left, right));
                    break;
                }
                case ReflectionOp.query: {
                    let right: any = this.pop();
                    const left = this.pop();

                    if (isType(left) && left.kind === ReflectionKind.objectLiteral) {
                        if (isType(right) && right.kind === ReflectionKind.literal) {
                            right = right.literal;
                        }

                        if ('string' === typeof right || 'number' === typeof right || 'symbol' === typeof right) {
                            const member = findMember(right, left);
                            if (member) {
                                if (member.kind === ReflectionKind.indexSignature) {
                                    this.pushType(member.type);
                                } else if (member.kind === ReflectionKind.method || member.kind === ReflectionKind.methodSignature) {
                                    this.pushType(member);
                                } else if (member.kind === ReflectionKind.property || member.kind === ReflectionKind.propertySignature) {
                                    this.pushType(member.type);
                                }
                            } else {
                                this.pushType({ kind: ReflectionKind.any });
                            }
                        } else {
                            this.pushType({ kind: ReflectionKind.any });
                        }
                    } else {
                        this.push({ kind: ReflectionKind.never });
                    }
                    break;
                }
                case ReflectionOp.keyof: {
                    const type = this.pop() as Type;
                    const union = { kind: ReflectionKind.union, members: [] } as TypeUnion;
                    this.push(union);
                    if (type.kind === ReflectionKind.objectLiteral) {
                        for (const member of type.members) {
                            if (member.kind === ReflectionKind.propertySignature) {
                                union.members.push({ kind: ReflectionKind.literal, literal: member.name } as TypeLiteral);
                            } else if (member.kind === ReflectionKind.methodSignature) {
                                union.members.push({ kind: ReflectionKind.literal, literal: member.name } as TypeLiteral);
                            }
                        }
                    }
                    break;
                }
                case ReflectionOp.var: {
                    this.push({ kind: ReflectionKind.never });
                    this.frame.variables++;
                    break;
                }
                case ReflectionOp.mappedType: {
                    const functionPointer = this.eatParameter(ops) as number;
                    const modifier = this.eatParameter(ops) as number;

                    if (this.frame.mappedType) {
                        const type = this.pop() as Type;
                        let index: Type | string | boolean | symbol | number | bigint = this.stack[this.frame.startIndex + 1] as Type;
                        if (index.kind === ReflectionKind.literal) {
                            index = index.literal;
                        }

                        const property: TypeProperty | TypePropertySignature = type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.property
                            ? type
                            : { kind: ReflectionKind.propertySignature, name: index, type } as TypePropertySignature;

                        if (modifier !== 0) {
                            if (modifier & MappedModifier.optional) {
                                property.optional = true;
                            }
                            if (modifier & MappedModifier.removeOptional && property.optional) {
                                property.optional = undefined;
                            }
                            if (modifier & MappedModifier.readonly) {
                                property.readonly = true;
                            }
                            if (modifier & MappedModifier.removeReadonly && property.readonly) {
                                property.readonly = undefined;
                            }
                        }
                        this.push(property);
                    } else {
                        this.frame.mappedType = new MappedType(this.pop() as Type);
                    }

                    const next = this.frame.mappedType.next();
                    if (next === undefined) {
                        //end
                        const types = this.popFrame();
                        this.push({ kind: ReflectionKind.objectLiteral, members: types });
                    } else {
                        this.stack[this.frame.startIndex + 1] = next;
                        this.call(-2);
                        this.program = functionPointer - 1; //-1 because next iteration does program++
                    }
                    break;
                }
                case ReflectionOp.loads: {
                    const frameOffset = this.eatParameter(ops) as number;
                    const stackEntryIndex = this.eatParameter(ops) as number;
                    if (frameOffset === 0) {
                        this.push(this.stack[this.frame.startIndex + 1 + stackEntryIndex]);
                    } else if (frameOffset === 1) {
                        this.push(this.stack[this.frame.previous!.startIndex + 1 + stackEntryIndex]);
                    } else if (frameOffset === 2) {
                        this.push(this.stack[this.frame.previous!.previous!.startIndex + 1 + stackEntryIndex]);
                    } else if (frameOffset === 3) {
                        this.push(this.stack[this.frame.previous!.previous!.previous!.startIndex + 1 + stackEntryIndex]);
                    }
                    break;
                }
                case ReflectionOp.arg: {
                    const arg = this.eatParameter(ops) as number;
                    this.push(this.stack[this.frame.startIndex - arg]);
                    break;
                }
                case ReflectionOp.return: {
                    this.returnFrame();
                    break;
                }
                case ReflectionOp.call: {
                    const arg = this.eatParameter(ops) as number;
                    this.call();
                    this.program = arg - 1; //-1 because next iteration does program++
                    break;
                }
                case ReflectionOp.frame: {
                    this.pushFrame();
                    break;
                }
                case ReflectionOp.jump: {
                    const arg = this.eatParameter(ops) as number;
                    this.program = arg - 1; //-1 because next iteration does program++
                    break;
                }
                case ReflectionOp.inline: {
                    const pPosition = this.eatParameter(ops) as number;
                    const p = initialStack[pPosition] as Packed;
                    const pack = unpack(p);
                    const processor = new Processor();
                    const type = processor.run(pack.ops, pack.stack);
                    this.push(type);
                    break;
                }
                case ReflectionOp.inlineCall: {
                    const pPosition = this.eatParameter(ops) as number;
                    const argumentSize = this.eatParameter(ops) as number;
                    const inputs: any[] = [];
                    for (let i = 0; i < argumentSize; i++) {
                        inputs.push(this.pop());
                    }
                    const p = initialStack[pPosition] as Packed;
                    const pack = unpack(p);
                    const processor = new Processor();
                    const type = processor.run(pack.ops, pack.stack, inputs);
                    this.push(type);
                    break;
                }
            }
        }

        return this.stack[this.stackPointer] as Type;
    }


    push(entry: StackEntry): void {
        this.stack[++this.stackPointer] = entry;
    }

    pop(): StackEntry {
        if (this.stackPointer < 0) throw new Error('Stack empty');
        return this.stack[this.stackPointer--];
    }

    pushFrame(): void {
        this.frame = {
            startIndex: this.stackPointer,
            previous: this.frame,
            variables: 0,
            inputs: [],
        };
    }

    popFrame(): StackEntry[] {
        const result = this.stack.slice(this.frame.startIndex + this.frame.variables + 1, this.stackPointer + 1);
        this.stackPointer = this.frame.startIndex;
        if (this.frame.previous) this.frame = this.frame.previous;
        return result;
    }

    /**
     * Create a new stack frame with the calling convention.
     */
    call(jumpBack: number = 1): void {
        this.push(this.program + jumpBack); //the `return address`
        this.pushFrame();
    }

    /**
     * Removes the stack frame, and puts the latest entry on the stack.
     */
    returnFrame(): void {
        const returnValue = this.pop(); //latest entry on the stack is the return value
        const returnAddress = this.stack[this.frame.startIndex]; //startIndex points the to new frame - 1 position, which is the `return address`.
        this.stackPointer = this.frame.startIndex - 1; //-1 because call convention adds `return address` before entering new frame
        this.push(returnValue);
        if ('number' === typeof returnAddress) this.program = returnAddress - 1; //-1 because iteration does program++
        if (this.frame.previous) this.frame = this.frame.previous;
    }

    pushType(type: Type): void {
        this.push(type);
    }

    eatParameter(ops: ReflectionOp[]): RuntimeStackEntry {
        return ops[++this.program];
    }
}

function findMember(
    index: string | number | symbol, type: { members: Type[] }
): TypePropertySignature | TypeMethodSignature | TypeMethod | TypeProperty | TypeIndexSignature | undefined {
    const indexType = typeof index;

    for (const member of type.members) {
        if (member.kind === ReflectionKind.propertySignature && member.name === index) return member;
        if (member.kind === ReflectionKind.methodSignature && member.name === index) return member;
        if (member.kind === ReflectionKind.property && member.name === index) return member;
        if (member.kind === ReflectionKind.method && member.name === index) return member;

        if (member.kind === ReflectionKind.indexSignature) {
            if (member.index.kind === ReflectionKind.string && 'string' === indexType) return member;
            if (member.index.kind === ReflectionKind.number && 'number' === indexType) return member;
            //todo: union
            //todo symbol
            // if (member.index.kind === ReflectionKind.symbol && 'symbol' === indexType) return member;
        }
    }

    return;
}
