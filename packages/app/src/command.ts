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
import { ClassDecoratorResult, createClassDecoratorContext, createPropertyDecoratorContext, FreeFluidDecorator, PropertyApiTypeInterface } from '@deepkit/type';

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

class ArgDefinition {
    isFlag: boolean = false;
    description: string = '';
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

    get hidden() {
        this.t.hidden = true;
        return;
    }

    description(description: string) {
        this.t.description = description;
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
