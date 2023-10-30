import { getClassName } from '@deepkit/core';
import {
    deserialize,
    metaAnnotation,
    ReflectionClass,
    ReflectionFunction,
    ReflectionKind,
    ReflectionParameter,
    ReflectionProperty,
    Type,
    typeToObject,
    validate,
    ValidationError,
    ValidationErrorItem
} from '@deepkit/type';
import { Command as OclifCommandBase } from '@oclif/command';
import { Command as OclifCommand } from '@oclif/config';
import { args, flags } from '@oclif/parser';
import { IBooleanFlag, IOptionFlag } from '@oclif/parser/lib/flags';
import { InjectorContext } from '@deepkit/injector';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import { ArgDefinition, cli } from './command.js';
import { EventDispatcher } from '@deepkit/event';
import { onAppError, onAppExecute, onAppExecuted, onAppShutdown } from './app.js';
import { ControllerConfig } from './service-container.js';

function convert(propertySchema: ReflectionParameter, value: any) {
    if (value === undefined && !propertySchema.isValueRequired()) {
        return undefined;
    }
    value = deserialize(value, undefined, undefined, undefined, propertySchema.type);
    const errors = validate(value, propertySchema.type);
    if (errors.length) {
        throw errors[0];
    }
    return value;
}

function getProperty(reflectionClass: ReflectionClass<any>, ref: { property: string; parameterIndex?: number; }): ReflectionProperty | ReflectionParameter {
    return ref.parameterIndex !== undefined
        ? reflectionClass.getMethodParameters(ref.property)[ref.parameterIndex]
        : reflectionClass.getProperty(ref.property);
}

function supportedAsArgument(type: Type): boolean {
    if (type.kind === ReflectionKind.string || type.kind === ReflectionKind.number || type.kind === ReflectionKind.boolean || type.kind === ReflectionKind.literal) return true;
    if (type.kind === ReflectionKind.union) return type.types.every(v => supportedAsArgument(v));
    return false;
}

export function buildOclifCommand(
    name: string,
    eventDispatcher: EventDispatcher,
    injector: InjectorContext,
    controller: ControllerConfig
): OclifCommand.Plugin {
    const oclifArgs: args.Input = [];
    const oclifFlags: { [name: string]: IBooleanFlag<any> | IOptionFlag<any> } = {};
    const argDefinitions = controller.controller ? cli._fetch(controller.controller) : undefined;

    if (controller.controller && (!argDefinitions || !argDefinitions.name)) {
        throw new Error(`No command name set for ${getClassName(controller.controller)}. use @cli.controller('name')`);
    }
    const services: { [name: string]: any } = {};
    const mappedNames: string[] = [];

    const parameters = controller.callback
        ? ReflectionFunction.from(controller.callback).getParameters()
        : controller.controller
            ? ReflectionClass.from(controller.controller).getMethod('execute').getParameters()
            : [];

    function getOptions(property: ReflectionProperty | ReflectionParameter, hidden: boolean) {
        return {
            name: property.name,
            description: '',
            hidden,
            required: !(property.isOptional() || property.hasDefault()),
            multiple: property.type.kind === ReflectionKind.array,
            default: property.getDefaultValue(),
        };
    }

    function add(property: ReflectionProperty | ReflectionParameter, hidden: boolean, char: string) {
        const options = getOptions(property, hidden);
        oclifFlags[property.name] = property.type.kind === ReflectionKind.boolean ? flags.boolean(options) : flags.string(options);
        if (char) {
            oclifFlags[property.name].char = char as any;
        }
    }

    function addProperty(property: ReflectionProperty | ReflectionParameter, argDefinition?: ArgDefinition) {
        if (mappedNames.includes(property.name)) return;
        mappedNames.push(property.name);

        const metaFlag = metaAnnotation.getForName(property.type, 'cli:flag');
        const flagOptions = metaFlag && metaFlag.length ? typeToObject(metaFlag[0]) : {};

        const forFlag = !!metaFlag || (argDefinition ? argDefinition.isFlag : false);
        const hidden = (argDefinition ? argDefinition.hidden : flagOptions.hidden) === true;

        if (forFlag) {
            add(property, hidden, flagOptions.char || (argDefinition ? argDefinition.char : ''));
        } else if (supportedAsArgument(property.type)) {
            oclifArgs.push(getOptions(property, hidden));
        } else {
            if (property.type.kind === ReflectionKind.array) {
                throw new Error(`Array type not supported for ${property.name}. Mark as flag instead.`);
            }
            //inject as service
            services[property.name] = property.type;
        }
    }

    //property injection possible, too
    if (controller.controller && argDefinitions) {
        const classSchema = ReflectionClass.from(controller.controller);
        for (const arg of argDefinitions.args) {
            const property = getProperty(classSchema, arg);
            addProperty(property, arg);
        }
    }

    for (const property of parameters) {
        addProperty(property);
    }

    return {
        aliases: [], description: argDefinitions ? argDefinitions.description : '', args: oclifArgs, flags: oclifFlags, hidden: false, id: name,
        load(): OclifCommand.Class {
            const label = controller.controller ? getClassName(controller.controller) : controller.callback ? controller.callback.name : '';

            class Clazz extends OclifCommandBase {
                static args = oclifArgs;
                static flags = oclifFlags;

                async run() {
                    let stopwatch: Stopwatch | undefined;
                    try {
                        stopwatch = injector.get(Stopwatch);
                    } catch {
                    }

                    const { flags, args } = this.parse(Clazz);
                    const methodArgs: any[] = [];
                    const parameterValues: { [name: string]: any } = {};

                    for (const propertySchema of parameters) {
                        try {
                            const v = services[propertySchema.name]
                                ? injector.get(services[propertySchema.name])
                                : convert(propertySchema, args[propertySchema.name] ?? flags[propertySchema.name]);
                            methodArgs.push(v);
                            parameterValues[propertySchema.name] = v;
                        } catch (e) {
                            if (e instanceof ValidationError) {
                                for (const item of e.errors) {
                                    console.error(`Validation error in argument ${propertySchema.name + (item.path ? '.' + item.path : '')}: ${item.message} [${item.code}]`);
                                }
                                return 8;
                            }
                            if (e instanceof ValidationErrorItem) {
                                console.error(`Validation error in argument ${propertySchema.name + (e.path ? '.' + e.path : '')}: ${e.message} [${e.code}]`);
                                return 8;
                            }
                            console.error('Error validation arguments', e);
                            return 8;
                        }
                    }

                    let exitCode: any;

                    await eventDispatcher.dispatch(onAppExecute, { command: name, parameters: parameterValues, injector });

                    const frame = stopwatch ? stopwatch.start(name + '(' + label + ')', FrameCategory.cli, true) : undefined;

                    try {
                        const execute: Function = controller.controller ? controller.controller.prototype['execute'] : controller.callback;
                        const thisArg = controller.controller ? injector.get(controller.controller, controller.module) : undefined;

                        if (frame) {
                            exitCode = await frame.run(() => execute.apply(thisArg, methodArgs));
                        } else {
                            exitCode = await execute.apply(thisArg, methodArgs);
                        }

                        exitCode = exitCode || 0;

                        await eventDispatcher.dispatch(onAppExecuted, { exitCode, command: name, parameters: parameterValues, injector });
                    } catch (error) {
                        await eventDispatcher.dispatch(onAppError, {
                            command: name,
                            parameters: parameterValues,
                            injector,
                            error: error instanceof Error ? error : new Error(String(error))
                        });
                        throw error;
                    } finally {
                        if (frame) frame.end();
                        await eventDispatcher.dispatch(onAppShutdown, { command: name, parameters: parameterValues, injector });
                    }
                    if (typeof exitCode === 'number') return exitCode;
                    return 0;
                }
            }

            return Clazz;
        }
    };
}
