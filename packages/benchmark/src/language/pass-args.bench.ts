import { BenchSuite } from '../bench';

export function main() {
    const bench = new BenchSuite('map');

    function a(type) {
    }

    function b(type = (b as any).Ω) {
    }

    class Database {
        a(type) {
        }
        b(type: any = (this as any).b.Ω) {
        }
    }

    bench.add('function direct', () => {
        b();
    });

    bench.add('function with types', () => {
        ((b as any).Ω = () => [], b)();
    });

    bench.add('function indirect', () => {
        //@ts-ignore
        ((b as any).Ω = [], b)();
    });

    const db = new Database();
    bench.add('method direct', () => {
        db.b();
    });

    bench.add('method with types', () => {
        ((db.b as any).Ω = () => [], db).b();
    });

    bench.run();
}
