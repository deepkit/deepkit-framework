
function createInjector(token1, token2) {
    let service1Resolved;
    let service2Resolved;

    return function(token) {
        switch (token) {
            case Service1: {
                if (!service1Resolved) service1Resolved = new token1;
                return service1Resolved;
            }
            case Service2: {
                if (!service2Resolved) service2Resolved = new token2;
                return service2Resolved;
            }
        }
    }
}

class Service1 {}
class Service2 {}

const injector = createInjector(Service1, Service2);

for (let i = 0; i < 100000; i++) {
    const s1 = injector(Service1);
}

console.log('status', %GetOptimizationStatus(injector).toString(2).padStart(12, '0'));
