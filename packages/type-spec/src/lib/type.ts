/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export const enum MappedModifier {
    optional = 1 << 0,
    removeOptional = 1 << 1,
    readonly = 1 << 2,
    removeReadonly = 1 << 3,
}

/**
 * note: Checks are based on range checks (>, <, etc), so when adding
 * new types a check is required for all code using `TypeNumberBrand`.
 */
export enum TypeNumberBrand {
    integer,

    int8,
    int16,
    int32,

    uint8,
    uint16,
    uint32,

    float,
    float32,
    float64,
}

/**
 * The instruction set.
 * Should not be greater than 93 members, because we encode it via charCode starting at 33. +93 means we end up with charCode=126
 * (which is '~' and the last char that can be represented without \x. The next 127 is '\x7F').
 */
export enum ReflectionOp {
    never,
    any,
    unknown,
    void,
    object,

    string,
    number,
    numberBrand,
    boolean,
    bigint,

    symbol,
    null,
    undefined,

    /**
     * The literal type of string, number, or boolean.
     *
     * This OP has 1 parameter. The next byte is the absolute address of the literal on the stack, which is the actual literal value.
     *
     * Pushes a function type.
     */
    literal,

    /**
     * This OP pops all types on the current stack frame.
     *
     * This OP has 1 parameter. The next byte is the absolute address of a string|number|symbol entry on the stack.
     *
     * Pushes a function type.
     */
    function,

    /**
     * This OP pops all types on the current stack frame.
     *
     * Pushes a method type.
     */
    method,
    methodSignature, //has 1 parameter, reference to stack for its property name

    parameter,

    /**
     * This OP pops the latest type entry on the stack.
     *
     * Pushes a property type.
     */
    property,
    propertySignature, //has 1 parameter, reference to stack for its property name

    /**
     * This OP pops all types on the current stack frame. Those types should be method|property.
     *
     * Pushes a TypeClass onto the stack.
     */
    class,

    /**
     * If a class extends another class with generics, this OP represents the generic type arguments of the super class.
     *
     * e.g. `class A extends B<string, boolean>`, string and boolean are on the stack and classExtends pops() them, and then assigns to A.extendsTypeArguments = [string, boolean].
     *
     * This is only emitted when the class that is currently being described actually extends another class and uses generics.
     *
     * This OP has 1 argument and pops x types from the stack. X is the first argument.
     * Expects a TypeClass on the stack.
     */
    classExtends,

    /**
     * This OP has 1 parameter, the stack entry to the actual class symbol.
     */
    classReference,

    /**
     * Marks the last entry in the stack as optional. Used for method|property. Equal to the QuestionMark operator in a property assignment.
     */
    optional,
    readonly,

    //modifiers for property|method
    public,
    private,
    protected,
    abstract,
    defaultValue,
    description,
    rest,

    regexp,

    enum,
    enumMember, //has one argument, the name.

    set,
    map,

    /**
     * Pops the latest stack entry and uses it as T for an array type.
     *
     * Pushes an array type.
     */
    array,
    tuple,
    tupleMember,
    namedTupleMember, //has one argument, the name.

    union, //pops frame. requires frame start when stack can be dirty.
    intersection,

    indexSignature,
    objectLiteral,
    mappedType, //2 parameters: functionPointer and modifier.
    in,

    frame, //creates a new stack frame
    moveFrame, //pop() as T, pops the current stack frame, push(T)
    return,

    templateLiteral,

    //special instructions that exist to emit less output
    date,

    //those typed array OPs are here only to reduce runtime code overhead when used in types.
    int8Array,
    uint8ClampedArray,
    uint8Array,
    int16Array,
    uint16Array,
    int32Array,
    uint32Array,
    float32Array,
    float64Array,
    bigInt64Array,
    arrayBuffer,

    promise,

    // pointer, //parameter is a number referencing an entry in the stack, relative to the very beginning (0). pushes that entry onto the stack.
    arg, //@deprecated. parameter is a number referencing an entry in the stack, relative to the beginning of the current frame, *-1. pushes that entry onto the stack. this is related to the calling convention.
    typeParameter, //generic type parameter, e.g. T in a generic. has 1 parameter: reference to the name.
    typeParameterDefault, //generic type parameter with a default value, e.g. T in a generic. has 1 parameter: reference to the name. pop() for the default value
    var, //reserve a new variable in the stack
    loads, //pushes to the stack a referenced value in the stack. has 2 parameters: <frame> <index>, frame is a negative offset to the frame, and index the index of the stack entry withing the referenced frame

    indexAccess, //T['string'], 2 items on the stack
    keyof, //keyof operator
    infer, //2 params, like `loads`
    typeof, //1 parameter that points to a function returning the runtime value from which we need to extract the type

    condition,
    jumpCondition, //@deprecated. used when INFER is used in `extends` conditional branch. 2 args: left program, right program
    jump, //jump to an address
    call, //has one parameter, the next program address. creates a new stack frame with current program address as first stack entry, and jumps back to that + 1.
    inline,
    inlineCall,
    distribute,//has one parameter, the co-routine program index.

    extends, //X extends Y in a conditional type, XY popped from the stack, pushes boolean on the stack

    widen, //widens the type on the stack, .e.g 'asd' => string, 34 => number, etc. this is necessary for infer runtime data, and widen if necessary (object member or non-contained literal)

    static,
    mappedType2, //same as mappedType2 but the given functionPointer returns a tuple [type, name]

    functionReference, //Same as classReference but for functions

    callSignature, //Same as function but for call signatures (in object literals)
}
