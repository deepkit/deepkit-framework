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

const stack: (RuntimeStackEntry | Type)[] = new Array(64);

export function executeType(ops: ReflectionOp[], references: RuntimeStackEntry[]): Type {
    type StackEntry = RuntimeStackEntry | Type;
    let stackPointer = -1;
    const frames: number[] = [];

    function push(entry: StackEntry) {
        stack[++stackPointer] = entry;
    }

    function pop(): StackEntry {
        if (stackPointer < 0) throw new Error('Stack empty');
        return stack[stackPointer--];
    }

    function pushFrame() {
        frames.push(stackPointer);
    }

    function popFrame(): StackEntry[] {
        let t = frames.pop() ?? -1;
        const result = stack.slice(t + 1, stackPointer + 1);
        stackPointer = t;
        return result;
    }

    function pushType(type: Type) {
        push(type);
    }

    let program = 0;

    function eatParameter(): RuntimeStackEntry {
        return ops[++program];
    }

    for (; program < ops.length; program++) {
        const op = ops[program];
        if (op === ReflectionOp.string) {
            pushType({ kind: ReflectionKind.string });
        } else if (op === ReflectionOp.number) {
            pushType({ kind: ReflectionKind.number });
        } else if (op === ReflectionOp.boolean) {
            pushType({ kind: ReflectionKind.boolean });
        } else if (op === ReflectionOp.void) {
            pushType({ kind: ReflectionKind.void });
        } else if (op === ReflectionOp.undefined) {
            pushType({ kind: ReflectionKind.undefined });
        } else if (op === ReflectionOp.bigint) {
            pushType({ kind: ReflectionKind.bigint });
        } else if (op === ReflectionOp.null) {
            pushType({ kind: ReflectionKind.null });
        } else if (op === ReflectionOp.literal) {
            const ref = eatParameter() as number;
            pushType({ kind: ReflectionKind.literal, literal: references[ref] as string | number | boolean });
        } else if (op === ReflectionOp.date) {
            pushType({ kind: ReflectionKind.class, classType: Date, types: [] });
        } else if (op === ReflectionOp.uint8Array) {
            pushType({ kind: ReflectionKind.class, classType: Uint8Array, types: [] });
        } else if (op === ReflectionOp.int8Array) {
            pushType({ kind: ReflectionKind.class, classType: Int8Array, types: [] });
        } else if (op === ReflectionOp.uint8ClampedArray) {
            pushType({ kind: ReflectionKind.class, classType: Uint8ClampedArray, types: [] });
        } else if (op === ReflectionOp.uint16Array) {
            pushType({ kind: ReflectionKind.class, classType: Uint16Array, types: [] });
        } else if (op === ReflectionOp.int16Array) {
            pushType({ kind: ReflectionKind.class, classType: Int16Array, types: [] });
        } else if (op === ReflectionOp.uint32Array) {
            pushType({ kind: ReflectionKind.class, classType: Uint32Array, types: [] });
        } else if (op === ReflectionOp.int32Array) {
            pushType({ kind: ReflectionKind.class, classType: Int32Array, types: [] });
        } else if (op === ReflectionOp.float32Array) {
            pushType({ kind: ReflectionKind.class, classType: Float32Array, types: [] });
        } else if (op === ReflectionOp.float64Array) {
            pushType({ kind: ReflectionKind.class, classType: Float64Array, types: [] });
        } else if (op === ReflectionOp.bigInt64Array) {
            pushType({ kind: ReflectionKind.class, classType: 'undefined' !== typeof BigInt64Array ? BigInt64Array : class BigInt64ArrayNotAvailable {}, types: [] });
        } else if (op === ReflectionOp.arrayBuffer) {
            pushType({ kind: ReflectionKind.class, classType: ArrayBuffer, types: [] });
        } else if (op === ReflectionOp.class) {
            const ref = eatParameter() as number;
            pushType({ kind: ReflectionKind.class, classType: (references[ref] as Function)(), types: popFrame() as Type[] });
        } else if (op === ReflectionOp.enum) {
            const ref = eatParameter() as number;
            pushType({ kind: ReflectionKind.enum, enumType: (references[ref] as Function)() });
        } else if (op === ReflectionOp.set) {
            pushType({ kind: ReflectionKind.class, classType: Set, types: [pop() as Type] });
        } else if (op === ReflectionOp.map) {
            const value = pop() as Type;
            const key = pop() as Type;
            pushType({ kind: ReflectionKind.class, classType: Map, types: [key, value] });
        } else if (op === ReflectionOp.promise) {
            pushType({ kind: ReflectionKind.promise, type: pop() as Type });
        } else if (op === ReflectionOp.union) {
            const types = popFrame() as Type[];
            pushType({ kind: ReflectionKind.union, types });
        } else if (op === ReflectionOp.array) {
            pushType({ kind: ReflectionKind.array, elementType: pop() as Type });
        } else if (op === ReflectionOp.property) {
            const name = references[eatParameter() as number] as number | string | symbol;
            pushType({ kind: ReflectionKind.property, type: pop() as Type, visibility: ReflectionVisibility.public, name });
        } else if (op === ReflectionOp.propertySignature) {
            const name = references[eatParameter() as number] as number | string | symbol;
            pushType({ kind: ReflectionKind.propertySignature, type: pop() as Type, name });
        } else if (op === ReflectionOp.method || op === ReflectionOp.methodSignature) {
            const name = references[eatParameter() as number] as number | string | symbol;
            const types = popFrame() as Type[];
            const returnType: Type = types.length > 0 ? types[types.length - 1] : { kind: ReflectionKind.any };
            const parameters = types.length > 1 ? types.slice(0, -1) : [];

            if (op === ReflectionOp.method) {
                pushType({ kind: ReflectionKind.method, visibility: ReflectionVisibility.public, name, return: returnType, parameters });
            } else {
                pushType({ kind: ReflectionKind.methodSignature, name, return: returnType, parameters });
            }

        } else if (op === ReflectionOp.optional) {
            (stack[stackPointer] as TypeLiteralMember).optional = true;
        } else if (op === ReflectionOp.protected) {
            (stack[stackPointer] as TypeLiteralMember).visibility = ReflectionVisibility.protected;
        } else if (op === ReflectionOp.private) {
            (stack[stackPointer] as TypeLiteralMember).visibility = ReflectionVisibility.private;
        } else if (op === ReflectionOp.abstract) {
            (stack[stackPointer] as TypeLiteralMember).abstract = true;
        } else if (op === ReflectionOp.indexSignature) {
            const type = pop() as Type;
            const index = pop() as Type;
            pushType({
                kind: ReflectionKind.indexSignature,
                index, type
            });
        } else if (op === ReflectionOp.objectLiteral) {
            const members = popFrame() as (TypeIndexSignature | TypePropertySignature | TypeMethodSignature)[];
            pushType({
                kind: ReflectionKind.objectLiteral,
                members
            });
        } else if (op === ReflectionOp.function) {
            const types = popFrame() as Type[];
            pushType({
                kind: ReflectionKind.function,
                return: types.length > 0 ? types[types.length - 1] : { kind: ReflectionKind.any },
                parameters: types.length > 1 ? types.slice(0, -1) : []
            });
        } else if (op === ReflectionOp.push) {
            push(references[eatParameter() as number]);
        } else if (op === ReflectionOp.condition) {
            const right = pop() as Type;
            const left = pop() as Type;
            const condition = pop() as number | boolean;
            condition ? pushType(left) : pushType(right);
        } else if (op === ReflectionOp.extends) {
            const right = pop() as string | number | boolean | Type;
            const left = pop() as string | number | boolean | Type;
            push(isAssignable(left, right));
        } else if (op === ReflectionOp.query) {
            let right: any = pop();
            const left = pop();

            if (isType(left) && left.kind === ReflectionKind.objectLiteral) {
                if (isType(right) && right.kind === ReflectionKind.literal) {
                    right = right.literal;
                }

                if ('string' === typeof right || 'number' === typeof right || 'symbol' === typeof right) {
                    const member = findMember(right, left);
                    if (member) {
                        if (member.kind === ReflectionKind.indexSignature) {
                            pushType(member.type);
                        } else if (member.kind === ReflectionKind.method || member.kind === ReflectionKind.methodSignature) {
                            pushType(member);
                        } else if (member.kind === ReflectionKind.property || member.kind === ReflectionKind.propertySignature) {
                            pushType(member.type);
                        }
                    } else {
                        pushType({ kind: ReflectionKind.any });
                    }
                } else {
                    pushType({ kind: ReflectionKind.any });
                }
            }
        } else if (op === ReflectionOp.frame) {
            pushFrame();
        }
    }

    return stack[stackPointer] as Type;
}

function findMember(index: string | number | symbol, type: { members: Type[] }): TypePropertySignature | TypeMethodSignature | TypeMethod | TypeProperty | TypeIndexSignature | undefined {
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
