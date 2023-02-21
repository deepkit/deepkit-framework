import { BenchSuite } from '../bench.js';

export function main() {
    const bench = new BenchSuite('map');
    const g = globalThis;
    g.Ω = [];

    globalThis.Ω = [];

    function a(type) {
    }

    function b(type = globalThis.Ω[0]) {
    }

    // class Database {
    //     a(type) {
    //     }
    //     b(type: any = (this as any).b.Ω) {
    //     }
    // }

    bench.add('function direct', () => {
        b();
    });

    // bench.add('function with types', () => {
    //     ((b as any).Ω = () => [], b)();
    // });
    //
    // bench.add('function indirect', () => {
    //     //@ts-ignore
    //     ((b as any).Ω = [], b)();
    // });

    class Decorator {
        protected yes = true;

        response<T>() {
            if (!this.yes) throw new Error('Lost context');
            return this;
        }

        response2<T>() {
            if (!this.yes) throw new Error('Lost context');
            return this;
        }
    }

    const d = new Decorator();

    bench.add('deep direct', () => {
        d.response().response2();
    });

    var r;

    bench.add('deep pass', () => {
        (((globalThis as any).Ω = [], r = d.response()), (globalThis as any).Ω = [], r).response2();
    });

    bench.add('function indirect 2', () => {
        //@ts-ignore
        b.Ω = [];
        b();
    });

    bench.add('function global', () => {
        (globalThis.Ω = [], b)();
    });

    function passArg(fn: Function, args: []): Function {
        g.Ω = args;
        return fn;
    }

    bench.add('pass arg', () => {
        passArg(() => {}, [])();
    });

    bench.add('dynamic function', () => {
        (() => {
        })();
    });

    bench.add('dynamic function object.assign __type assignment', () => {
        Object.assign(() => {
        }, { __type: [] })();
    });

    function assignType(fn: Function, type: any): Function {
        if (!(fn as any).__type) (fn as any).__type = type;
        return fn;
    }

    bench.add('dynamic function custom __type assignment', () => {
        assignType(() => {
        }, [])();
    });

    // const db = new Database();
    // bench.add('method direct', () => {
    //     db.b();
    // });

    // bench.add('method with types', () => {
    //     ((db.b as any).Ω = () => [], db).b();
    // });

    bench.run();
}
