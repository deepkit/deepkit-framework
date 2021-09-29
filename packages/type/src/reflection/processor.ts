import { ReflectionOp, RuntimeStackEntry } from './compiler';
import {
    isType,
    ReflectionKind,
    ReflectionVisibility,
    Type,
    TypeIndexSignature,
    TypeLiteralMember,
    TypeMethod,
    TypeMethodSignature,
    TypeProperty,
    TypePropertySignature
} from './type';
import { isAssignable } from './extends';


type StackEntry = RuntimeStackEntry | Type;

function newArray<T>(init: T, items: number): T[] {
    const a: T[] = [];
    for (let i = 0; i < items; i++) {
        a.push(init);
    }
    return a;
}

interface Frame {
    startIndex: number; //when the frame started, index of the stack
    previous?: Frame;
}

export class Processor {
    stack: (RuntimeStackEntry | Type)[] = newArray({ kind: ReflectionKind.any }, 128);
    stackPointer = -1; //pointer to the stack
    frame: Frame = { startIndex: -1 };
    program: number = 0;

    run(ops: ReflectionOp[], references: RuntimeStackEntry[]) {
        // if (ops.length === 1 && ops[0] === ReflectionOp.string) return { kind: ReflectionKind.string };

        for (let i = 0; i < references.length; i++) {
            this.stack[i] = references[i];
        }

        this.stackPointer = references.length - 1;
        this.frame.startIndex = this.stackPointer;
        this.frame.previous = undefined;

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
                case ReflectionOp.undefined:
                    this.pushType({ kind: ReflectionKind.undefined });
                    break;
                case ReflectionOp.bigint:
                    this.pushType({ kind: ReflectionKind.bigint });
                    break;
                case ReflectionOp.null:
                    this.pushType({ kind: ReflectionKind.null });
                    break;
                case ReflectionOp.literal: {
                    const ref = this.eatParameter(ops) as number;
                    this.pushType({ kind: ReflectionKind.literal, literal: references[ref] as string | number | boolean });
                    break;
                }
                case ReflectionOp.date:
                    this.pushType({ kind: ReflectionKind.class, classType: Date, types: [] });
                    break;
                case ReflectionOp.uint8Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Uint8Array, types: [] });
                    break;
                case ReflectionOp.int8Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Int8Array, types: [] });
                    break;
                case ReflectionOp.uint8ClampedArray:
                    this.pushType({ kind: ReflectionKind.class, classType: Uint8ClampedArray, types: [] });
                    break;
                case ReflectionOp.uint16Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Uint16Array, types: [] });
                    break;
                case ReflectionOp.int16Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Int16Array, types: [] });
                    break;
                case ReflectionOp.uint32Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Uint32Array, types: [] });
                    break;
                case ReflectionOp.int32Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Int32Array, types: [] });
                    break;
                case ReflectionOp.float32Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Float32Array, types: [] });
                    break;
                case ReflectionOp.float64Array:
                    this.pushType({ kind: ReflectionKind.class, classType: Float64Array, types: [] });
                    break;
                case ReflectionOp.bigInt64Array:
                    this.pushType({ kind: ReflectionKind.class, classType: 'undefined' !== typeof BigInt64Array ? BigInt64Array : class BigInt64ArrayNotAvailable {}, types: [] });
                    break;
                case ReflectionOp.arrayBuffer:
                    this.pushType({ kind: ReflectionKind.class, classType: ArrayBuffer, types: [] });
                    break;
                case ReflectionOp.class: {
                    const ref = this.eatParameter(ops) as number;
                    this.pushType({ kind: ReflectionKind.class, classType: (references[ref] as Function)(), types: this.popFrame() as Type[] });
                    break;
                }
                case ReflectionOp.enum: {
                    const ref = this.eatParameter(ops) as number;
                    this.pushType({ kind: ReflectionKind.enum, enumType: (references[ref] as Function)() });
                    break;
                }
                case ReflectionOp.set:
                    this.pushType({ kind: ReflectionKind.class, classType: Set, types: [this.pop() as Type] });
                    break;
                case ReflectionOp.map:
                    const value = this.pop() as Type;
                    const key = this.pop() as Type;
                    this.pushType({ kind: ReflectionKind.class, classType: Map, types: [key, value] });
                    break;
                case ReflectionOp.promise:
                    this.pushType({ kind: ReflectionKind.promise, type: this.pop() as Type });
                    break;
                case ReflectionOp.union: {
                    const types = this.popFrame() as Type[];
                    this.pushType({ kind: ReflectionKind.union, types });
                    break;
                }
                case ReflectionOp.function: {
                    const types = this.popFrame() as Type[];
                    this.pushType({
                        kind: ReflectionKind.function,
                        return: types.length > 0 ? types[types.length - 1] : { kind: ReflectionKind.any },
                        parameters: types.length > 1 ? types.slice(0, -1) : []
                    });
                    break;
                }
                case ReflectionOp.array:
                    this.pushType({ kind: ReflectionKind.array, elementType: this.pop() as Type });
                    break;
                case ReflectionOp.property: {
                    const name = references[this.eatParameter(ops) as number] as number | string | symbol;
                    this.pushType({ kind: ReflectionKind.property, type: this.pop() as Type, visibility: ReflectionVisibility.public, name });
                    break;
                }
                case ReflectionOp.propertySignature: {
                    const name = references[this.eatParameter(ops) as number] as number | string | symbol;
                    this.pushType({ kind: ReflectionKind.propertySignature, type: this.pop() as Type, name });
                    break;
                }
                case ReflectionOp.method:
                case ReflectionOp.methodSignature: {
                    const name = references[this.eatParameter(ops) as number] as number | string | symbol;
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
                    this.push(references[this.eatParameter(ops) as number]);
                    break;
                }
                case ReflectionOp.condition: {
                    const right = this.pop() as Type;
                    const left = this.pop() as Type;
                    const condition = this.pop() as number | boolean;
                    condition ? this.pushType(left) : this.pushType(right);
                    break;
                }
                case ReflectionOp.jumpCondition: {
                    const leftProgram = this.eatParameter(ops) as number;
                    const rightProgram = this.eatParameter(ops) as number;
                    const condition = this.pop() as number | boolean;
                    this.call();
                    if (condition) {
                        this.program = leftProgram - 1;
                    } else {
                        this.program = rightProgram - 1;
                    }
                    break;
                }
                case ReflectionOp.extends: {
                    const right = this.pop() as string | number | boolean | Type;
                    const left = this.pop() as string | number | boolean | Type;
                    this.push(isAssignable(left, right));
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
                    this.program = arg - 1;
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
        };
    }

    popFrame(): StackEntry[] {
        const result = this.stack.slice(this.frame.startIndex + 1, this.stackPointer + 1);
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
