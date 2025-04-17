import { ClassType, CompilerContext, isPrototypeOfBase } from '@deepkit/core';
import { InjectorContext, InjectorModule, Scope } from '@deepkit/injector';
import { getActions, RpcAction, rpcClass } from './decorators.js';
import {
    ChannelSubType,
    ContextDispatcher,
    getActionOffset,
    getRouteDirectPort,
    getRouteDirectSrc,
    isContextFlag,
    isRouteFlag,
    MessageFlag,
    readUint16LE,
    writeContextNoRoute,
    writeUint16LE,
} from './protocol.js';
import {
    assertType,
    executeTemplates,
    JitStack,
    NamingStrategy,
    parametersToTuple,
    ReflectionClass,
    ReflectionKind,
    serializeType,
    TemplateState,
    Type,
    typeOf,
    typeSettings,
    TypeTuple,
    UnpopulatedCheck,
} from '@deepkit/type';
import {
    AutoBuffer,
    AutoBufferSerializer,
    AutoBufferSerializerState,
    BaseParser,
    bsonBinarySerializer,
    seekElementSize,
    writeUint32LE,
} from '@deepkit/bson';
import { ActionMode, EntitySubject } from './model.js';
import { Collection } from './collection.js';
import { isBehaviorSubject, isSubject, ProgressTracker, ProgressTrackerState } from '@deepkit/core-rxjs';
import { isObservable, Observable } from 'rxjs';
import { fnv1aHash, ParsedSchemaAction, rpcEncodeError, schemaError, schemaMapping, SchemaMapping } from './encoders.js';
import { TransportConnection } from './transport.js';

type ActionMapping = { actionName: string, action: number, mode: ActionMode, parameters: TypeTuple, type: Type };

interface ActionState {
    controller: ClassType;
    method: Function;
    resolver: (scope: Scope) => any;
    action: RpcAction;
    mapping: ActionMapping;
    returnSerializer: AutoBufferSerializer;
    buffer: AutoBuffer;
}

type Apply = (dispatcherState: { last?: ActionState }, bodyOffset: number, message: Uint8Array, scope: Scope) => any;

function setDeserializerCode(context: CompilerContext, code: string[], tuple: TypeTuple) {
    const parser = new BaseParser(new Uint8Array, 0);
    const parserState = { parser, elementType: 0 };
    context.set({ parser, state: parserState });
    code.push(`parser.buffer = message; parser.offset = offset; parser.size = message.byteLength;`);

    const jitStack = new JitStack();
    const namingStrategy = new NamingStrategy();

    let i = 0;
    for (const parameter of tuple.types) {
        const varName = `values[${i++}]`;
        const state = new TemplateState(varName, '', context, bsonBinarySerializer.bsonDeserializeRegistry, namingStrategy, jitStack, ['']);
        state.target = 'deserialize';
        code.push(`
    state.elementType = parser.eatByte();
    ${executeTemplates(state, parameter.type)}
        `);
    }
}

function setSerializerCode(context: CompilerContext, code: string[], tuple: TypeTuple) {
    context.set({
        typeSettings,
        seekElementSize,
        UnpopulatedCheck,
    });

    const jitStack = new JitStack();
    const namingStrategy = new NamingStrategy();

    code.push(`
    const unpopulatedCheck = typeSettings.unpopulatedCheck;
    typeSettings.unpopulatedCheck = UnpopulatedCheck.ReturnSymbol;
    `);

    let i = 0;
    for (const parameter of tuple.types) {
        const varName = `data[${i++}]`;
        const state = new TemplateState('', varName, context, bsonBinarySerializer.bsonSerializeRegistry, namingStrategy, jitStack, ['']).disableSetter();
        code.push(`
    state.writer.typeOffset = state.writer.offset++;
    ${executeTemplates(state, parameter.type)}
        `);
    }

    code.push(`
    typeSettings.unpopulatedCheck = unpopulatedCheck;
    `);
}

// aka parameterDeserializer
function createActionApply(state: ActionState): Apply {
    const context = new CompilerContext();
    context.set({
        values: [],
        actionState: state,
    });
    const mapping = state.mapping;

    const code: string[] = [];

    setDeserializerCode(context, code, mapping.parameters);

    return context.raw(`
return function apply_${state.action.name}(dispatcherState, offset, message, scope) {
    'use strict';
    dispatcherState.last = actionState;
    const controller = actionState.resolver(scope);

    ${code.join('\n')}

    return controller.${state.action.name}.apply(controller, values);
};
    `) as Apply;
}

export function createParameterSerializer(action: ParsedSchemaAction) {
    const context = new CompilerContext();
    const code: string[] = [];

    setSerializerCode(context, code, action.parameters);

    return context.raw(`
return function parameterSerializer(data, state) {
    'use strict';
    ${code.join('\n')}
};
    `) as AutoBufferSerializer;
}

export function createReturnSerializer(type: Type): AutoBufferSerializer {
    const context = new CompilerContext();
    context.set({ values: [] });
    const tuple = getTupleForType(type);
    const code: string[] = [];
    setSerializerCode(context, code, tuple);
    const assignVar = type.kind === ReflectionKind.tuple ? '' : 'values[0] = data; data = values;';

    return context.raw(`
return function returnSerializer(data, state) {
    'use strict';
    ${assignVar}
    ${code.join('\n')}
};
    `) as AutoBufferSerializer;
}

export function createReturnDeserializer(type: Type) {
    const context = new CompilerContext();
    context.set({
        values: [],
    });
    const code: string[] = [];

    const tuple = getTupleForType(type);
    setDeserializerCode(context, code, tuple);

    const returnValue = type.kind === ReflectionKind.tuple ? `values` : `values[0]`;

    return context.raw(`
return function returnDeserializer(message, offset) {
    'use strict';

    ${code.join('\n')}
    
    return ${returnValue};
};
    `) as (message: Uint8Array, offset: number) => any;
}

function getTupleForType(type: Type): TypeTuple {
    if (type.kind === ReflectionKind.tuple) return type;
    // to get union types, we need to use a tuple, since only
    // container types (array or object) in BSON have type information
    const tuple = { kind: ReflectionKind.tuple, types: [] } as TypeTuple;
    tuple.types.push({ kind: ReflectionKind.tupleMember, parent: tuple, type });
    return tuple;
}

function serializeError(data: any, state: AutoBufferSerializerState) {
    const error = rpcEncodeError(data);
    schemaError.encode(error, state);
}

function setHeader(src: number, dist: number, port: number, contextId: number, autoBuffer: AutoBuffer, flag: MessageFlag) {
    autoBuffer.prepend = dist ? 1 + 4 + 4 + 2 + 2 : 3;
    const buffer = autoBuffer._buffer;

    if (dist) {
        buffer[0] = MessageFlag.RouteDirect | flag;
        writeUint32LE(buffer, 1, src);
        writeUint32LE(buffer, 5, dist);
        writeUint16LE(buffer, 9, port);
        writeUint16LE(buffer, 11, contextId);
        autoBuffer.setOffset(13);
    } else {
        buffer[0] = MessageFlag.RouteClient | flag;
        writeContextNoRoute(buffer, contextId);
        autoBuffer.setOffset(3);
    }
}

function getChannelSubTypeFromResult(value: any): ChannelSubType {
    if (isObservable(value)) {
        if (isSubject(value)) {
            if (isBehaviorSubject(value)) return ChannelSubType.BehaviorSubject;
            return ChannelSubType.Subject;
        }
        return ChannelSubType.Observable;
    }
    // if ReadableStream
    if (value instanceof ReadableStream) {
        return ChannelSubType.ReadableStream;
    }
    if (value instanceof ProgressTracker) {
        return ChannelSubType.ProgressTracker;
    }
    if (value instanceof WritableStream) {
        return ChannelSubType.WritableStream;
    }
    if (value instanceof TransformStream) {
        return ChannelSubType.TransformStream;
    }
    return ChannelSubType.None;
}

export class ActionExecutor {
    protected errorBuffer = new AutoBuffer();

    src: number = 0;

    constructor(
        private dispatcher: ActionDispatcher,
        private selfContext: ContextDispatcher,
        private transport: TransportConnection,
        private scope: Scope,
    ) {
    }

    protected sendError(dst: number, port: number, contextId: number, error: any) {
        this.selfContext.release(contextId);
        console.log('sendError', error);
        setHeader(this.src, dst, port, contextId, this.errorBuffer, MessageFlag.TypeError | MessageFlag.ContextEnd);
        this.errorBuffer.apply(serializeError, error);
        this.transport.write(this.errorBuffer.buffer);
    }

    protected sendValue(dst: number, port: number, contextId: number, state: ActionState, value: any) {
        // todo: what if we need to split big response unto chunks.
        //  there is no automatic mechanism for that yet.
        //  would also be nice to support streaming.
        const empty = value === undefined;
        const channelSubType = getChannelSubTypeFromResult(value);

        const flag = empty
            ? MessageFlag.TypeAck | MessageFlag.ContextEnd
            : channelSubType
                ? MessageFlag.TypeChannel | MessageFlag.ContextExisting
                : MessageFlag.TypeResult | MessageFlag.ContextEnd;

        setHeader(this.src, dst, port, contextId, state.buffer, flag);
        if (channelSubType) {
            state.buffer.state.writer.writeByte(channelSubType);
        } else if (empty) {
            this.selfContext.release(contextId);
        } else {
            this.selfContext.release(contextId);
            state.buffer.apply(state.returnSerializer, value);
        }

        // console.log({ empty, flag, channelSubType, value, buffer: state.buffer.buffer });
        this.transport.write(state.buffer.buffer);
    }

    execute(message: Uint8Array) {
        if (!isContextFlag(message[0], MessageFlag.ContextNew)) {
            // fire and forget
            try {
                const res = this.dispatcher.dispatch(message, this.scope);
                if (res instanceof Promise) {
                    res.catch(() => {

                    });
                }
            } catch {
            }
            return;
        }

        const direct = isRouteFlag(message[0], MessageFlag.RouteDirect);
        const dst = direct ? getRouteDirectSrc(message) : 0;
        const port = direct ? getRouteDirectPort(message) : 0;

        const id = this.selfContext.create((message) => {
            // more messages are coming
        });

        try {
            const res = this.dispatcher.dispatch(message, this.scope);
            const state = this.dispatcher.state.last!;

            if (res instanceof Promise) {
                res.then(value => {
                    this.sendValue(dst, port, id, state, value);
                }).catch((error: any) => {
                    this.sendError(dst, port, id, error);
                });
            } else {
                this.sendValue(dst, port, id, state, res);
            }
        } catch (error: any) {
            this.sendError(dst, port, id, error);
        }
    }
}

/**
 * @reflection never
 */
export class ActionDispatcher {
    protected actions: Apply[] = [];

    protected mapping: { [controllerName: string]: ActionMapping[] } = {};

    state: { last?: ActionState } = {};

    schemaMessage?: Uint8Array;
    schemaMessageHash = 0;

    getMapping() {
        return this.mapping;
    }

    build(injector: InjectorContext, controllers: Iterable<{ name: string, controller: ClassType, module: InjectorModule }>) {
        this.actions = [];
        this.mapping = {};

        for (const controller of controllers) {
            const resolver = injector.resolve(controller.module, controller.controller);
            const knownActions = getActions(controller.controller);

            let controllerName = controller.name;
            const controllerMapping = this.mapping[controllerName] ||= [];

            const rpcConfig = rpcClass._fetch(controller.controller);
            if (rpcConfig) controllerName = rpcConfig.getPath();
            const reflection = ReflectionClass.from(controller.controller);

            for (const [name, action] of knownActions) {
                const methodReflection = reflection.getMethod(action.name);
                const method = methodReflection.type;
                assertType(method, ReflectionKind.method);

                let unwrappedReturnType = methodReflection.getReturnType();
                if (unwrappedReturnType.kind === ReflectionKind.promise) {
                    unwrappedReturnType = unwrappedReturnType.type;
                }
                const fullType = unwrappedReturnType;
                if (unwrappedReturnType.kind === ReflectionKind.union) {
                    //if e.g. Subject | undefined, we take the non-undefined type
                    const nonNullUndefined = unwrappedReturnType.types.filter(v => v.kind !== ReflectionKind.undefined && v.kind !== ReflectionKind.null);
                    if (nonNullUndefined.length === 1) {
                        unwrappedReturnType = nonNullUndefined[0];
                    }
                }

                let type: Type = fullType;
                let mode: ActionMode = 'arbitrary';
                const parameters: TypeTuple = parametersToTuple(methodReflection.getParameters().map(v => v.parameter));

                if (unwrappedReturnType.kind === ReflectionKind.class) {
                    if (isPrototypeOfBase(unwrappedReturnType.classType, Collection)) {
                        mode = 'collection';
                        type = unwrappedReturnType.typeArguments ? unwrappedReturnType.typeArguments[0] : { kind: ReflectionKind.any };
                        // collectionSchema = {
                        //     kind: ReflectionKind.objectLiteral,
                        //     types: [{
                        //         kind: ReflectionKind.propertySignature,
                        //         name: 'v',
                        //         parent: Object as any,
                        //         optional: true,
                        //         type: { kind: ReflectionKind.array, type: type },
                        //     }],
                        // };
                        //
                        // collectionQueryModel = typeOf<CollectionQueryModelInterface<unknown>>([type]) as TypeObjectLiteral;
                    } else if (isPrototypeOfBase(unwrappedReturnType.classType, EntitySubject)) {
                        mode = 'entitySubject';
                        type = unwrappedReturnType.typeArguments ? unwrappedReturnType.typeArguments[0] : { kind: ReflectionKind.any };
                    } else if (isPrototypeOfBase(unwrappedReturnType.classType, ProgressTracker)) {
                        mode = 'observable';
                        type = typeOf<ProgressTrackerState[] | undefined>();
                        // nextType = type;
                    } else if (isPrototypeOfBase(unwrappedReturnType.classType, Observable)) {
                        mode = 'observable';
                        type = unwrappedReturnType.typeArguments ? unwrappedReturnType.typeArguments[0] : { kind: ReflectionKind.any };
                        // nextType = type;
                    }
                }

                const mapping: ActionMapping = {
                    actionName: name,
                    action: this.actions.length,
                    mode,
                    parameters,
                    type,
                };
                controllerMapping.push(mapping);

                this.actions.push(createActionApply({
                    controller: controller.controller,
                    method: controller.controller.prototype[name],
                    mapping,
                    resolver,
                    action,
                    returnSerializer: createReturnSerializer(type),
                    buffer: new AutoBuffer(),
                }));
            }
        }

        const mapping: SchemaMapping = {};
        for (const [controllerName, actions] of Object.entries(this.mapping)) {
            const controllerActions: SchemaMapping[string] = [];
            for (const action of actions) {
                controllerActions.push([action.actionName, action.action, action.mode, serializeType(action.parameters), serializeType(action.type)]);
            }
            mapping[controllerName] = controllerActions as any;
        }
        this.schemaMessage = schemaMapping.encode(mapping);
        this.schemaMessageHash = fnv1aHash(this.schemaMessage);
    }

    dispatch(message: Uint8Array, scope: Scope) {
        const offset = getActionOffset(message[0]);
        const actionId = readUint16LE(message, offset);
        const apply = this.actions[actionId];
        if (!apply) throw new Error(`Action not found: ${actionId}`);
        return apply(this.state, offset + 2, message, scope);
    }
}

