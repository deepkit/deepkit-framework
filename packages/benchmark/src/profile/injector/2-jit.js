function createInjector(tokens) {
    let i = 0;
    const pre = [];
    const lines = [];
    const context = {};

    function build(token) {
        const tokenVar = 'token' + i++;
        const resolvedVar = 'resolved' + i++;
        context[tokenVar] = token;
        context[resolvedVar] = undefined;

        pre.push(`
            let ${resolvedVar};
        `);

        lines.push(`
            case ${tokenVar}: {
                if (${resolvedVar}) return ${resolvedVar};
                ${resolvedVar} = new ${tokenVar};
                return ${resolvedVar};
            }
        `);
    }

    for (const t of tokens) {
        build(t);
    }

    console.log('create function');
    return new Function(...Object.keys(context), `
        return function(token) {
            ${pre.join('\n')}
            switch (token) {
                ${lines.join('\n')}
            }
        }
    `)(...Object.values(context));
}

class Service1 {
}

class Service2 {
}

class Service3 {
}

const injector1 = createInjector([Service1, Service2, Service3]);
console.log(injector1(Service1));

for (let i = 0; i < 100000; i++) {
    const s1 = injector1(Service1);
}
console.log('status', % GetOptimizationStatus(injector1).toString(2).padStart(12, '0'))

