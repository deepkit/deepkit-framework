/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export class CompilerContext {
    public readonly context = new Map<string, any>();

    public maxReservedVariable: number = 10_000;

    reserveVariable(name: string = 'var', value?: any): string {
        for (let i = 0; i < this.maxReservedVariable; i++) {
            const candidate = name + '_' + i;
            if (!this.context.has(candidate)) {
                this.context.set(candidate, value);
                return candidate;
            }
        }

        throw new Error(`Too many context variables (max ${this.maxReservedVariable})`);
    }

    build(functionCode: string, ...args: string[]): Function {
        functionCode = `
            return function(${args.join(', ')}){ 
                ${functionCode}
            };
        `;
        return new Function(...this.context.keys(), functionCode)(...this.context.values());
    }
}
