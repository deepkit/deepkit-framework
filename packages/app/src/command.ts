/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, getClassName } from '@deepkit/core';
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
    deserialize,
    FreeFluidDecorator,
    PropertyApiTypeInterface,
    ReflectionClass,
    ReflectionKind,
    ReflectionParameter,
    ReflectionProperty,
    validate,
    ValidationErrorItem
} from '@deepkit/type';
import { Command as OclifCommandBase } from '@oclif/command';
import { Command as OclifCommand } from '@oclif/config';
import { args, flags } from '@oclif/parser';
import { IBooleanFlag, IOptionFlag } from '@oclif/parser/lib/flags';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';

class ArgDefinitions {
    name: string = '';
    description: string = '';
    args: ArgDefinition[] = [];
}

class CommandDecorator {
    t = new ArgDefinitions;

    controller(name: string, options?: { description?: string }) {
        this.t.name = name;
        if (options) {
            if (options.description) this.t.description = options.description;
        }
    }

    addArg(arg: ArgDefinition) {
        this.t.args.unshift(arg);
    }
}

export const cli: ClassDecoratorResult<typeof CommandDecorator> = createClassDecoratorContext(CommandDecorator);

function getProperty(classType: ClassType, ref: {property: string; parameterIndex?: number;}): ReflectionProperty | ReflectionParameter {
    return ref.parameterIndex !== undefined
        ? ReflectionClass.from(classType).getMethodParameters(ref.property)[ref.parameterIndex]
        : ReflectionClass.from(classType).getProperty(ref.property);
}

class ArgDefinition {
    isFlag: boolean = false;
    multiple: boolean = false;
    hidden: boolean = false;
    char: string = '';
    property!: string;
    parameterIndex?: number;
}

export class ArgDecorator implements PropertyApiTypeInterface<ArgDefinition> {
    t = new ArgDefinition;

    onDecorator(classType: ClassType, property: string | undefined, parameterIndex?: number): void {
        if (!property) throw new Error('arg|flag needs to be on a method argument or class property, .e.g execute(@arg hostname: string) {}');

        this.t.property = property;
        this.t.parameterIndex = parameterIndex;

        const aBase = cli._fetch(Object.getPrototypeOf(classType.prototype)?.constructor);
        if (aBase) {
            const a = cli._fetch(classType);
            if (a) {
                a.args.unshift(...aBase.args);
            }
        }

        cli.addArg(this.t)(classType);
    }

    get multiple() {
        this.t.multiple = true;
        return;
    }

    get hidden() {
        this.t.hidden = true;
        return;
    }

    char(char: string) {
        this.t.char = char;
    }
}

export class ArgFlagDecorator extends ArgDecorator {
    onDecorator(classType: ClassType, property: string | undefined, parameterIndex?: number): void {
        this.t.isFlag = true;
        super.onDecorator(classType, property, parameterIndex);
    }
}

export const arg = createPropertyDecoratorContext(ArgDecorator);
export const flag = createPropertyDecoratorContext(ArgFlagDecorator);

export type CommandArgs = { [name: string]: FreeFluidDecorator<ArgDecorator> };

export interface Command {
    execute(...args: any[]): Promise<number | void> | number | void;
}

export function isCommand(classType: ClassType<Command>) {
    return !!cli._fetch(classType);
}

export function buildOclifCommand(name: string, injector: InjectorContext, classType: ClassType<Command>, module: InjectorModule<any>): OclifCommand.Plugin {
    const oclifArgs: args.Input = [];
    const oclifFlags: { [name: string]: IBooleanFlag<any> | IOptionFlag<any> } = {};
    const argDefinitions = cli._fetch(classType);
    if (!argDefinitions) throw new Error(`No command name set. use @cli.controller('name')`);
    if (!argDefinitions.name) throw new Error(`No command name set. use @cli.controller('name')`);

    let converters = new Map<ReflectionProperty | ReflectionParameter, (v: any) => any>();

    for (const property of argDefinitions.args) {
        const propertySchema = getProperty(classType, property);
        converters.set(propertySchema, (value: any) => {
            if (value === undefined && !propertySchema.isValueRequired()) {
                return undefined;
            }
            value = deserialize(value, undefined, undefined, undefined, propertySchema.type);
            const errors = validate(value, propertySchema.type);
            if (errors.length) {
                throw errors[0];
            }
            return value;
        });
    }

    for (const i in argDefinitions.args) {
        if (!argDefinitions.args.hasOwnProperty(i)) continue;
        const t = argDefinitions.args[i];
        const propertySchema = getProperty(classType, t);

        const options = {
            name: propertySchema.name,
            description: 'todo',
            hidden: t.hidden,
            required: !(propertySchema.isOptional() || propertySchema.hasDefault()),
            multiple: t.multiple,
            default: propertySchema.getDefaultValue(),
        };

        //todo, add `parse(i)` and make sure type is correct depending on t.propertySchema.type
        if (t.isFlag) {
            oclifFlags[propertySchema.name] = propertySchema.type.kind === ReflectionKind.boolean ? flags.boolean(options) : flags.string(options);
        } else {
            oclifArgs.push(options);
        }
    }

    return {
        aliases: [], description: argDefinitions.description, args: oclifArgs, flags: oclifFlags, hidden: false, id: argDefinitions.name,
        load(): OclifCommand.Class {
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
                    const instance = injector.get(classType, module);
                    const methodArgs: any[] = [];

                    for (const property of argDefinitions!.args) {
                        try {
                            const propertySchema = getProperty(classType, property);

                            const v = converters.get(propertySchema)!(args[propertySchema.name] ?? flags[propertySchema.name]);
                            if (propertySchema instanceof ReflectionParameter) {
                                methodArgs.push(v);
                            } else if (propertySchema instanceof ReflectionProperty) {
                                if (v !== undefined) {
                                    instance[propertySchema.name as keyof typeof instance] = v;
                                }
                            }
                        } catch (e) {
                            if (e instanceof ValidationErrorItem) {
                                console.log(`Validation error in ${e.path}: ${e.message} [${e.code}]`);
                                return 8;
                            }
                            console.log(e);
                            return 8;
                        }
                    }

                    let exitCode: any;

                    if (stopwatch) {
                        const frame = stopwatch.start(name + '(' + getClassName(classType) + ')', FrameCategory.cli, true);
                        try {
                            exitCode = await frame.run({}, () => instance.execute(...methodArgs));
                        } finally {
                            frame.end();
                        }
                    } else {
                        exitCode = await instance.execute(...methodArgs);
                    }
                    if (typeof exitCode === 'number') return exitCode;
                    return 0;
                }
            }

            return Clazz;
        }
    };
}
