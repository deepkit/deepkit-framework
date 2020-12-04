/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {args, flags} from '@oclif/parser';
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
    FreeFluidDecorator,
    getClassSchema,
    PropertyApiTypeInterface,
    PropertySchema
} from '@deepkit/type';
import {IBooleanFlag, IOptionFlag} from '@oclif/parser/lib/flags';
import {ClassType} from '@deepkit/core';
import {Command as OclifCommand} from '@oclif/config';
import {Command as OclifCommandBase} from '@oclif/command';
import {InjectorContext} from './injector/injector';

class ArgDefinitions {
    name: string = '';
    description: string = '';
    args: { [name: string]: ArgDefinition } = {};
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
        this.t.args[arg.name] = arg;
    }
}

export const cli: ClassDecoratorResult<typeof CommandDecorator> = createClassDecoratorContext(CommandDecorator);

class ArgDefinition {
    name: string = '';
    isFlag: boolean = false;
    propertySchema?: PropertySchema;
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
        //property is `execute` always since we use decorators on the method's arguments
        if (!property) throw new Error('arg|flag needs to be on a method argument, .e.g execute(@arg hostname: string) {}');
        if (parameterIndex === undefined) throw new Error('arg|flag needs to be on a method argument, .e.g execute(@arg hostname: string) {}');

        const properties = getClassSchema(classType).getMethodProperties(property);
        const propertySchema = properties[parameterIndex];

        this.t.name = propertySchema.name;
        this.t.propertySchema = propertySchema;

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

    const schema = getClassSchema(classType);
    const properties = schema.getMethodProperties('execute');

    for (const i in argDefinitions.args) {
        if (!argDefinitions.args.hasOwnProperty(i)) continue;
        const t = argDefinitions.args[i];
        if (!t.propertySchema) continue;

        const options = {
            name: i,
            description: t.description,
            hidden: t.hidden,
            required: !t.optional,
            multiple: t.multiple,
            default: t.default,
        };

        //todo, add `parse(i)` and make sure type is correct depending on t.propertySchema.type
        if (t.isFlag) {
            oclifFlags[i] = t.propertySchema.type === 'boolean' ? flags.boolean(options) : flags.string(options);
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
                    const {flags, args} = this.parse(Clazz);
                    const cliScopedContext = rootScopedContext.createChildScope('cli');
                    const instance = cliScopedContext.get(classType);
                    const methodArgs: any[] = [];

                    for (const property of properties) {
                        methodArgs.push(args[property.name] ?? flags[property.name]);
                    }

                    return instance.execute(...methodArgs);
                }
            }

            return Clazz;
        }
    };
}
