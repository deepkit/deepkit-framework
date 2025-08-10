/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

// @ts-ignore
import { indent } from './indent.js';
import { hasProperty } from './core.js';

declare var process: {
    env: Record<string, string>;
} | undefined;

const indentCode = ('undefined' !== typeof process && process.env?.DEBUG || '').includes('deepkit');

export class CompilerContext {
    public readonly context = new Map<string, any>();
    protected constVariables = new Map<any, string>();

    public maxReservedVariable: number = 10_000;
    protected reservedNames = new Set<string>();
    protected variableContext: { [name: string]: any } = {};

    /**
     * Code that is executed in the context, but before the actual function is generated.
     * This helps for example to initialize dynamically some context variables.
     */
    public preCode: string = '';

    public initialiseVariables: string[] = [];

    public config: { indent: boolean } = { indent: false };

    constructor(config: Partial<CompilerContext['config']> = {}) {
        Object.assign(this.config, config);
        this.context.set('_context', this.variableContext);
    }

    reserveName(name: string): string {
        for (let i = 0; i < this.maxReservedVariable; i++) {
            const candidate = name + '_' + i;
            if (!this.reservedNames.has(candidate)) {
                this.reservedNames.add(candidate);
                return candidate;
            }
        }

        throw new Error(`Too many context variables (max ${this.maxReservedVariable})`);
    }

    set(values: { [name: string]: any }) {
        for (const i in values) {
            if (!hasProperty(values, i)) {
                continue;
            }
            this.context.set(i, values[i]);
        }
    }

    /**
     * Returns always the same variable name for the same value.
     * The variable name should not be set afterwards.
     */
    reserveConst(value: any, name: string = 'constVar'): string {
        if (value === undefined) throw new Error('Can not reserve const for undefined value');
        let constName = this.constVariables.get(value);
        if (!constName) {
            constName = this.reserveName(name);
            this.constVariables.set(value, constName);
            this.context.set(constName, value);
        }

        return constName;
    }

    reserveVariable(name: string = 'var', value?: any): string {
        const freeName = this.reserveName(name);
        if (value === undefined) {
            //to get monomorphic variables, we return a reference to an unassigned object property (which has no type per se)
            return '_context.' + freeName;
        } else {
            //in case when the variable has a value, we simply store it, since it (hopefully) is monomorphic.
            this.context.set(freeName, value);
            return freeName;
        }
    }

    raw(functionCode: string): Function {
        try {
            return new Function(...this.context.keys(), `'use strict';\n` + functionCode)(...this.context.values());
        } catch (error) {
            throw new Error('Could not build function: ' + error + functionCode);
        }
    }

    protected format(code: string): string {
        if (indentCode || this.config.indent) return indent.js(code, { tabString: '    ' });
       return code;
    }

    build(functionCode: string, ...args: string[]): any {
        functionCode = this.format(`
            'use strict';
            ${this.preCode}
            return function self(${args.join(', ')}){
                'use strict';
                ${functionCode}
            };
        `);
        try {
            return new Function(...this.context.keys(), functionCode)(...this.context.values());
        } catch (error) {
            throw new Error(`Could not build function(${[...this.context.keys()].join(',')}): ` + error + functionCode);
        }
    }

    buildAsync(functionCode: string, ...args: string[]): Function {
        functionCode = `
            'use strict';
            ${this.preCode}
            return async function self(${args.join(', ')}){
                'use strict';
                ${functionCode}
            };
        `;
        try {
            return new Function(...this.context.keys(), this.format(functionCode))(...this.context.values());
        } catch (error) {
            throw new Error('Could not build function: ' + error + functionCode);
        }
    }
}
