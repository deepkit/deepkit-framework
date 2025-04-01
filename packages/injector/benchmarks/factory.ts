import { benchmark, run } from '@deepkit/bench';
import { InjectorContext } from '../src/injector.js';
import { InjectorModule } from '../src/module.js';
import { ClassType, CompilerContext, getClassName } from '@deepkit/core';

class ServiceA {
}

class ServiceB {
    constructor(public serviceA: ServiceA) {
    }
}

class ScopedServiceC {
    constructor(public serviceA: ServiceA) {
    }
}

function createInjector1() {
    function serviceAFactory() {
        const instance = new ServiceA();
        serviceA = () => instance;
        return instance;
    }

    let serviceA = serviceAFactory;

    function serviceBFactory() {
        const instance = new ServiceB(serviceA());
        serviceB = () => instance;
        return instance;
    }

    let serviceB = serviceBFactory;

    return { serviceA, serviceB };
}

function createInjector2() {
    const instances: any = {};
    const instances2: any = {};

    const A = { creating: 0, count: 0 };
    const B = { creating: 0, count: 0 };

    function reset() {
        A.creating = 0;
        B.creating = 0;
        C.creating = 0;
        state.creating = 1;
    }

    function serviceA() {
        if (instances.A) return instances.A;
        if (A.creating) throw new Error('circular dependency');
        A.creating = state.creating++;
        instances.A = new ServiceA();
        A.creating = 0;
        return instances.A;
    }

    function serviceB() {
        if (instances2.B) return instances2.B;
        if (B.creating) throw new Error('circular dependency');
        B.creating = state.creating++;
        instances2.B = new ServiceB(serviceA());
        B.creating = 0;
        return instances2.B;
    }

    const state = {
        faulty: 0,
        creating: 1,
    };

    const C = {
        creating: 0,
        count: 0,
    };

    // todo; test this shit with many services
    //  make a function to generate this code automatically based of an array
    function scopedServiceC(instances: any) {
        if (instances.C) return instances.C;
        if (C.creating) {
            reset();
            throw new Error('circular dependency');
        }
        if (state.faulty) reset();
        C.creating = state.creating++;
        state.faulty++;
        C.count++;
        instances.C = new ScopedServiceC(serviceA());
        state.faulty--;
        C.creating = 0;
        return instances.C;
    }

    function resolve(id: any) {
        switch (id) {
            case ScopedServiceC:
                return scopedServiceC;
            case ServiceA:
                return serviceA;
            case ServiceB:
                return serviceB;
        }
    }

    function circularCalls() {
        // const calls: { when: number, what: string }[] = [];
        // if (instanceACreating) calls.push({ when: instanceACreating, what: 'ServiceA' });
        // if (instanceBCreating) calls.push({ when: instanceBCreating, what: 'ServiceB' });
        // if (instanceCCreating) calls.push({ when: instanceCCreating, what: 'ScopedServiceC' });
        // calls.sort((a, b) => a.when - b.when);
        // return calls;
    }

    function get(token: any, scope?: any) {
        switch (token) {
            case ScopedServiceC:
                return scopedServiceC(scope);
            case ServiceA:
                return serviceA();
            case ServiceB:
                return serviceB();
        }
    }

    return { get, resolve };
}

interface Injector {
    resolve(token: any): (scope?: any) => any;

    get(token: any, scope?: any): any;
}

function createInjector3(providers: { provide: ClassType, scope?: string }[]): Injector {
    const compiler = new CompilerContext();
    const factories: string[] = [];
    const init: string[] = [];
    const resolver: string[] = [];

    const exports: string[] = [];
    const get: string[] = [];
    let idx = 0;
    let ids = 0;

    function getName(type: ClassType) {
        return getClassName(type) + ids++;
    }

    const normalized = providers.map(v => ({
        classType: v.provide,
        scope: v.scope || '',
        name: getName(v.provide),
    }));

    for (const provider of normalized) {
        const classTypeVar = compiler.reserveVariable(provider.name, provider.classType);

        const state = `s${provider.name}`;
        const instance = `instances.${provider.name}`;
        const arg = provider.scope ? 'instances' : '';
        const check = provider.scope ? `if (instances.name !== ${JSON.stringify(provider.scope)}) throw new Error('scope not found');` : '';

        factories.push(`
        function factory${provider.name}(${arg}) {
            ${check}
            if (${instance}) return ${instance};
            if (${state}.creating) {
                reset();
                throw new Error('circular dependency');
            }
            if (state.faulty) reset();
            ${state}.creating = state.creating++;
            state.faulty++;
            ${state}.count++;
            ${instance} = new ${classTypeVar}();
            state.faulty--;
            ${state}.creating = 0;
            return ${instance};
        }
        ${classTypeVar}[symbol] = factory${provider.name};
        `);

        resolver.push(`case ${classTypeVar}: return factory${provider.name};`);

        init.push(`
        const ${state} = {
            count: 0,
            creating: 0,
        };
        `);
    }

    // const resolveToken = `switch (token) { ${resolver.join('\n')}}`;
    // const resolveToken = `const f = token.f; if (f) return f;`
    // const resolveToken = `return map.get(token);`;
    const resolveToken = `
    const fn = token[symbol];
    if (fn) return fn;
    switch (token) {
               
    }
    `;

    return compiler.build(`
    const instances = {};
    const state = {
        faulty: 0,
        creating: 1,
    };
    
    const symbol = Symbol('injector');
    
    function reset() {
    }

    ${init.join('\n')}
    ${factories.join('\n')}

    function resolve(token) {
        ${resolveToken}
        throw new Error('No provider found for ' + token);
    }

    function get(token, scope) {
        return resolve(token)(scope);
        throw new Error('No provider found for ' + token);
    }

    return { resolve, get };
    `)();
}

const providers = [
    { provide: ServiceA },
    { provide: ServiceB },
    { provide: ScopedServiceC, scope: 'rpc' },
];

for (let i = 0; i < 200; i++) {
    class Service {
    }

    providers.unshift({ provide: Service });
}

console.log(`${providers.length} providers`);
const module = new InjectorModule(providers);
const injector = new InjectorContext(module);
const injector1 = createInjector1();
const injector2 = createInjector2();
const injector3 = createInjector3(providers);

const a = injector.get(ServiceA);
const b = injector.get(ServiceB);

// if (!(a instanceof ServiceA)) throw new Error('a is not ServiceA');
// if (!(b instanceof ServiceB)) throw new Error('b is not ServiceB');

// benchmark('injector1', () => {
//     injector1.serviceA();
//     injector1.serviceB();
// });

benchmark('injector.get', () => {
    injector.get(ServiceA);
});

const resolver1 = injector.resolver(undefined, ServiceA);

benchmark('injector resolver', () => {
    resolver1();
});

const scope1 = injector.createChildScope('rpc');
scope1.get(ScopedServiceC);

benchmark('injector scope create', () => {
    const scope = injector.createChildScope('rpc');
});

benchmark('injector scope create & get', () => {
    const scope = injector.createChildScope('rpc');
    scope.get(ScopedServiceC);
});

const resolvedScopedServiceC = injector.resolver(undefined, ScopedServiceC);
const scope = injector.createChildScope('rpc');
resolvedScopedServiceC(scope.scope);

benchmark('injector scope create & resolver', () => {
    const scope = injector.createChildScope('rpc');
    resolvedScopedServiceC(scope.scope);
});

const injectors = [
    // { name: 'injector2', injector: injector2 },
    { name: 'injector3', injector: injector3 },
];

for (const i of injectors) {
    const injector = i.injector;
    benchmark(`${i.name}`, () => {
        injector.get(ServiceA);
    });

    const resolveA = injector.resolve(ServiceA);

    benchmark(`${i.name} resolver`, () => {
        resolveA();
    });

    benchmark(`${i.name} scope create`, () => {
        // const scope = injector2.scopeRpc();
        const scope = {};
    });

    benchmark(`${i.name} scope create & get`, () => {
        // const scope = injector2.scopeRpc();
        // injector2.scopedServiceC(scope);
        const scope = {name: 'rpc'};
        injector.get(ScopedServiceC, scope);
    });

    const resolveC = injector.resolve(ScopedServiceC);
    benchmark(`${i.name} scope create & resolver`, () => {
        // const scope = injector2.scopeRpc();
        // injector2.scopedServiceC(scope);
        const scope = {name: 'rpc'};
        resolveC(scope);
    });

    const serviceA = new ServiceA();

    benchmark(`${i.name} scope create & get baseline`, () => {
        const scope: any = {};
        scope.service ||= new ScopedServiceC(serviceA);
    });

    const scope = {name: 'rpc'};
    benchmark(`${i.name} scope get`, () => {
        injector.get(ScopedServiceC, scope);
    });

    const resolve = injector.resolve(ScopedServiceC);

    benchmark(`${i.name} scope resolve`, () => {
        resolve(scope);
    });
}

// const state: any = {};
//
// benchmark('baseline', () => {
//     if (!state.instanceA) state.instanceA = new ServiceA();
//     if (!state.instanceB) state.instanceB = new ServiceB(state.instanceA);
// });
//
// let instanceA = {};
// let instanceB = {};
//
// benchmark('baseline2', () => {
//     instanceA ||= new ServiceA();
//     instanceB ||= new ServiceB(instanceA);
// });

run();
