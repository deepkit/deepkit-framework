import { ClassType, CompilerContext } from '@deepkit/core';
import { InjectorContext, InjectorModule, Scope } from '@deepkit/injector';
import { getActions, RpcAction, rpcClass } from './decorators.js';
import { getActionOffset, readUint16LE } from './protocol.js';
import {
    binaryBigIntAnnotation,
    executeTemplates,
    isDateType,
    isIntegerType,
    isMongoIdType,
    isUUIDType,
    JitStack,
    NamingStrategy,
    ReflectionClass,
    ReflectionKind,
    TemplateState,
    Type,
    TypeTuple,
    TypeTupleMember,
} from '@deepkit/type';
import { BaseParser, bsonBinarySerializer, BSONType, seekElementSize } from '@deepkit/bson';

interface ActionState {
    controller: ClassType;
    method: Function;
    resolver: (scope: Scope) => any;
    action: RpcAction;
}

type Apply = (bodyOffset: number, message: Uint8Array, scope: Scope) => void;

function isSimpleType(type: Type): boolean {
    return type.kind === ReflectionKind.string
        || type.kind === ReflectionKind.number
        || type.kind === ReflectionKind.boolean
        || type.kind === ReflectionKind.bigint
        || type.kind === ReflectionKind.object
        || type.kind === ReflectionKind.array
        || isMongoIdType(type)
        || isDateType(type)
        || isUUIDType(type);
}

function getBSONType(type: Type): BSONType {
    switch (type.kind) {
        case ReflectionKind.string: {
            if (isMongoIdType(type)) return BSONType.OID;
            if (isUUIDType(type)) return BSONType.BINARY;
            return BSONType.STRING;
        }
        case ReflectionKind.bigint: {
            const binaryBigInt = binaryBigIntAnnotation.getFirst(type);
            if (binaryBigInt) return BSONType.BINARY;
            return BSONType.LONG;
        }
        case ReflectionKind.number:
            if (isIntegerType(type)) return BSONType.INT;
            return BSONType.NUMBER;
        case ReflectionKind.boolean:
            return BSONType.BOOLEAN;
        case ReflectionKind.array:
            return BSONType.ARRAY;
        case ReflectionKind.class: {
            if (isDateType(type)) return BSONType.DATE;
            return BSONType.OBJECT;
        }
    }
    throw new Error('Needs to be aligned with isSimpleType');
}

function createActionApply(state: ActionState): Apply {
    const context = new CompilerContext();
    context.set({
        resolver: state.resolver,
        action: state.action,
        BaseParser,
        seekElementSize,
    });

    const parse: string[] = [];
    const args: string[] = [];
    const methodReflection = ReflectionClass.from(state.controller).getMethod(state.action.name);
    const parameters = methodReflection.getParameters();

    if (parameters.length) {
        const parser = new BaseParser(new Uint8Array, 0);
        const state = { parser, elementType: 0 };
        context.set({ parser, state });
        // parse.push(`const view = new DataView(message.buffer, message.byteOffset, message.byteLength)`);
        // parse.push(`const parser = new BaseParser(message, offset);`);
        // parse.push(`const parser = new BaseParser(message, offset); const state = { parser: parser, elementType: 0 };`);
        parse.push(`parser.buffer = message; parser.offset = offset; parser.size = message.byteLength;`);

        const isSimpleArguments = methodReflection.getParameters().every(p => !p.isOptional() && isSimpleType(p.type));
        const jitStack = new JitStack();
        const namingStrategy = new NamingStrategy();

        if (isSimpleArguments) {
            let i = 0;

            for (const parameter of parameters) {
                const varName = context.reserveVariable('arg' + i++);
                const state = new TemplateState(varName, '', context, bsonBinarySerializer.bsonDeserializeRegistry, namingStrategy, jitStack, ['']);
                state.target = 'deserialize';
                parse.push(`
        state.elementType = ${getBSONType(parameter.type)};
        ${executeTemplates(state, parameter.type)}
                `);
                args.push(varName);
            }
        } else {
            // use a tuple deserializer
            const tuple: TypeTuple = {
                kind: ReflectionKind.tuple,
                types: [],
            };
            for (const parameter of parameters) {
                const member: TypeTupleMember = {
                    kind: ReflectionKind.tupleMember,
                    type: parameter.type,
                    name: parameter.name,
                    parent: tuple,
                };
                if (parameter.isOptional()) member.optional = true;
                tuple.types.push(member);
            }
            const varName = context.reserveVariable('args');
            const state = new TemplateState(varName, '', context, bsonBinarySerializer.bsonDeserializeRegistry, namingStrategy, jitStack, ['']);
            state.target = 'deserialize';
            parse.push(executeTemplates(state, tuple));
            args.push(`...${varName}`);
        }
    }

    return context.raw(`
return function apply(offset, message, scope) {
    'use strict';

    const controller = resolver(scope);
    
    ${parse.join('\n')}
    
    return controller.${state.action.name}(${args.join(', ')});
}; 
    `) as Apply;
}

/**
 * @reflection never
 */
export class ActionDispatcher {
    // protected actions: ActionState[] = [];
    protected actions: Apply[] = [];

    protected mapping: { [controllerName: string]: { actionName: string, action: number }[] } = {};

    getMapping() {
        return this.mapping;
    }

    build(injector: InjectorContext, controllers: Iterable<{ name: string, controller: ClassType, module: InjectorModule }>) {
        this.actions = [];
        this.mapping = {};

        for (const controller of controllers) {
            const resolver = injector.resolver(controller.module, controller.controller);
            const knownActions = getActions(controller.controller);

            let controllerName = controller.name;
            const controllerMapping = this.mapping[controllerName] ||= [];

            const rpcConfig = rpcClass._fetch(controller.controller);
            if (rpcConfig) controllerName = rpcConfig.getPath();

            for (const [name, action] of knownActions) {
                controllerMapping.push({
                    actionName: name,
                    action: this.actions.length,
                });

                const state: ActionState = {
                    controller: controller.controller,
                    method: controller.controller.prototype[name],
                    resolver,
                    action,
                };
                const apply = createActionApply(state);
                this.actions.push(apply);
            }
        }
    }

    dispatch(message: Uint8Array, scope: Scope) {
        const offset = getActionOffset(message[0]);
        const actionId = readUint16LE(message, offset);
        const apply = this.actions[actionId];
        return apply(offset + 2, message, scope);
    }
}

