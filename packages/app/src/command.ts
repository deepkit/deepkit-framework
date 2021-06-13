/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
    FreeFluidDecorator,
    getClassSchema,
    getPropertyXtoClassFunction,
    jitValidateProperty,
    jsonSerializer,
    PropertyApiTypeInterface,
    PropertySchema,
    t,
    ValidationFailedItem
} from '@deepkit/type';
import { Command as OclifCommandBase } from '@oclif/command';
import { Command as OclifCommand } from '@oclif/config';
import { args, flags } from '@oclif/parser';
import { IBooleanFlag, IOptionFlag } from '@oclif/parser/lib/flags';
import { InjectorContext } from '@deepkit/injector';

class ArgDefinitions {
    name: string = '';
    description: string = '';
    args: ArgDefinition[] = [];

    getArg(name: string): ArgDefinition {
        for (const arg of this.args) if (arg.name === name) return arg;
        throw new Error(`No argument with name ${name} found`);
    }
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

class ArgDefinition {
    name: string = '';
    isFlag: boolean = false;
    propertySchema!: PropertySchema;
    multiple: boolean = false;
    hidden: boolean = false;
    char: string = '';
    optional: boolean = false;
    description: string = '';
    default: any;
}

export class ArgDecorator implements PropertyApiTypeInterface<ArgDefinition> {
    t = new ArgDefinition;

    onDecorator(classType: ClassType, property: string | undefined, parameterIndex?: number): void {
        if (!property) throw new Error('arg|flag needs to be on a method argument or class property, .e.g execute(@arg hostname: string) {}');
        const schema = getClassSchema(classType);

        if (parameterIndex === undefined && !schema.hasProperty(property)) {
            //make sure its known in ClassSchema
            t(classType.prototype, property);
        }

        const propertySchema = parameterIndex !== undefined
            ? getClassSchema(classType).getMethodProperties(property)[parameterIndex]
            : getClassSchema(classType).getProperty(property);

        this.t.name = propertySchema.name;
        this.t.propertySchema = propertySchema;

        if (this.t.optional) propertySchema.isOptional = true;

        const aBase = cli._fetch(Object.getPrototypeOf(classType.prototype)?.constructor);
        if (aBase) {
            const a = cli._fetch(classType);
            if (a) {
                a.args.unshift(...aBase.args);
            }
        }

        cli.addArg(this.t)(classType);
    }

    description(description: string) {
        this.t.description = description;
    }

    get optional() {
        this.t.optional = true;
        return;
    }

    default(value: any) {
        this.t.default = value;
        this.t.optional = true;
        return;
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
    execute(...args: any[]): Promise<any>;
}

export function isCommand(classType: ClassType<Command>) {
    return !!cli._fetch(classType);
}

export function buildOclifCommand(classType: ClassType<Command>, rootScopedContext: InjectorContext): OclifCommand.Plugin {
    const oclifArgs: args.Input = [];
    const oclifFlags: { [name: string]: IBooleanFlag<any> | IOptionFlag<any> } = {};
    const argDefinitions = cli._fetch(classType);
    if (!argDefinitions) throw new Error(`No command name set. use @cli.controller('name')`);
    if (!argDefinitions.name) throw new Error(`No command name set. use @cli.controller('name')`);

    let converters = new Map<PropertySchema, (v: any) => any>();

    for (const property of argDefinitions.args) {
        converters.set(property.propertySchema, (value: any) => {
            value = getPropertyXtoClassFunction(property.propertySchema, jsonSerializer)(value);
            const errors: ValidationFailedItem[] = [];
            jitValidateProperty(property.propertySchema)(
                value,
                property.propertySchema.name,
                errors
            );
            if (errors.length) {
                throw errors[0];
            }
            return value;
        });
    }

    for (const i in argDefinitions.args) {
        if (!argDefinitions.args.hasOwnProperty(i)) continue;
        const t = argDefinitions.args[i];

        const options = {
            name: t.name,
            description: t.description,
            hidden: t.hidden,
            required: !t.optional,
            multiple: t.multiple,
            default: t.default,
        };

        //todo, add `parse(i)` and make sure type is correct depending on t.propertySchema.type
        if (t.isFlag) {
            oclifFlags[t.name] = t.propertySchema.type === 'boolean' ? flags.boolean(options) : flags.string(options);
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
                    const { flags, args } = this.parse(Clazz);
                    const cliScopedContext = rootScopedContext.createChildScope('cli');
                    const instance = cliScopedContext.get(classType);
                    const methodArgs: any[] = [];

                    for (const property of argDefinitions!.args) {
                        try {
                            const v = converters.get(property.propertySchema)!(args[property.name] ?? flags[property.name]);
                            if (property.propertySchema.methodName === 'execute') {
                                methodArgs.push(v);
                            } else if (!property.propertySchema.methodName) {
                                if (v !== undefined) {
                                    instance[property.name as keyof typeof instance] = v;
                                }
                            }
                        } catch (e) {
                            if (e instanceof ValidationFailedItem) {
                                console.log(`Validation error in ${e.path}: ${e.message} [${e.code}]`);
                                return 8;
                            }
                            console.log(e);
                            return 8;
                        }
                    }

                    const exitCode = await instance.execute(...methodArgs);
                    if (typeof exitCode === 'number') return exitCode;
                    return 0;
                }
            }

            return Clazz;
        }
    };
}
