import { benchmark, run } from '@deepkit/bench';

let count = 0;

function test() {
    count++;
}

const map = {
    test: test,
};

function noop() {
}

const proxy: any = new Proxy({}, {
    get(target, key) {
        const fn = (map as any)[key];
        if (fn) {
            return fn;
        }
        return noop;
    },
});

benchmark('action proxy', () => {
    proxy.test();
});


run();
