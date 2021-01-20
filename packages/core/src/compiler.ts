/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export class CompilerContext {
    public readonly context = new Map<string, any>();

    public maxReservedVariable: number = 10_000;

    /**
     * Code that is executed in the context, but before the actual function is generated.
     * This helps for example to initialize dynamically some context variables.
     */
    public preCode: string = '';

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

    raw(functionCode: string): Function {
        return new Function(...this.context.keys(), functionCode)(...this.context.values());
    }

    build(functionCode: string, ...args: string[]): any {
        functionCode = `
            ${this.preCode}
            return function self(${args.join(', ')}){ 
                ${functionCode}
            };
        `;
        try {
            return new Function(...this.context.keys(), functionCode)(...this.context.values());
        } catch (error) {
            throw new Error('Could not build function: ' + error + functionCode);
        }
    }

    buildAsync(functionCode: string, ...args: string[]): Function {
        functionCode = `
            ${this.preCode}
            return async function self(${args.join(', ')}){ 
                ${functionCode}
            };
        `;
        try {
            return new Function(...this.context.keys(), functionCode)(...this.context.values());
        } catch (error) {
            throw new Error('Could not build function: ' + error + functionCode);
        }
    }
}
