class CompilerContext {
    constructor() {
        this.context = new Map();
        this.maxReservedVariable = 10000;
        this.reservedNames = new Set();
        this.variableContext = {};
        /**
         * Code that is executed in the context, but before the actual function is generated.
         * This helps for example to initialize dynamically some context variables.
         */
        this.preCode = '';
        this.initialiseVariables = [];
        this.context.set('_context', this.variableContext);
    }
    reserveName(name) {
        for (let i = 0; i < this.maxReservedVariable; i++) {
            const candidate = name + '_' + i;
            if (!this.reservedNames.has(candidate)) {
                this.reservedNames.add(candidate);
                return candidate;
            }
        }
        throw new Error(`Too many context variables (max ${this.maxReservedVariable})`);
    }
    reserveVariable(name = 'var', value) {
        const freeName = this.reserveName(name);
        if (value === undefined) {
            //to get monomorphic variables, we return a reference to an unassigned object property (which has no type per se)
            return '_context.' + freeName;
        }
        else {
            //in case when the variable has a value, we simply store it, since it (hopefully) is monomorphic.
            this.context.set(freeName, value);
            return freeName;
        }
    }
    raw(functionCode) {
        return new Function(...this.context.keys(), `'use strict';\n` + functionCode)(...this.context.values());
    }
    build(functionCode, ...args) {
        functionCode = `
            'use strict';
            ${this.preCode}
            return function self(${args.join(', ')}){
                'use strict';
                ${functionCode}
            };
        `;
        try {
            return new Function(...this.context.keys(), functionCode)(...this.context.values());
        }
        catch (error) {
            throw new Error('Could not build function: ' + error + functionCode);
        }
    }
}

const compiler = new CompilerContext();

class Service1 {
}

class Service2 {
}

class Service3 {
}

const pre = [];
const lines = [];

function build(token){
    const tokenVar = compiler.reserveVariable('token', token);
    const resolvedVar = compiler.reserveName('resolved');

    pre.push(`
            let ${resolvedVar};
        `);

    lines.push(`
        //
            case ${tokenVar}: {
                if (${resolvedVar}) return ${resolvedVar};
                ${resolvedVar} = new ${tokenVar};
                return ${resolvedVar};
            }
        `);
}

build(Service1);
build(Service2);

const fn = compiler.raw(`
        //HALLO?
        ${pre.join('\n')}

        return function(token, scope) {
            switch (token) {
            ${lines.join('\n')}
            }
        }
    `);

console.log(fn(Service1));
for (let i = 0; i < 100000; i++) {
    const s1 = fn(Service1);
}
console.log('status', % GetOptimizationStatus(fn).toString(2).padStart(12, '0'))

