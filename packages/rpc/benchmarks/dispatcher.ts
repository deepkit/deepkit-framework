import { ContextDispatcher } from '../src/protocol.js';
import { add, run } from '@deepkit/bench';

const message = new Uint8Array([1, 2, 3]);

function noop() {
}

class BaseLine extends ContextDispatcher {
    protected fn: any = noop;

    create(_fn: any) {
        this.fn = _fn;
        return 0;
    }

    release(id: number) {
    }

    dispatch(id: number, message: Uint8Array) {
        this.fn(message);
    }
}

function benchmarkReal(dispatcher: ContextDispatcher) {
    const ids: number[] = [];
    let created = 0;
    let peak = 0;
    return () => {
        // Randomly allocate/release to simulate dynamic usage
        if (Math.random() < 0.5 && ids.length > 0) {
            const id = ids.pop()!;
            dispatcher.release(id);
            created--;
        } else {
            let fn: any = noop;
            if (Math.random() < 0.5) {
                let i = 0;
                fn = (message: any) => {
                    message[0] = i;
                };
            }
            const id = dispatcher.create(fn);
            created++;
            if (created > peak) {
                peak = created;
            }
            ids.push(id);
        }

        if (ids.length > 0) {
            dispatcher.dispatch(ids[Math.floor(Math.random() * ids.length)], message);
        }
    };
}

// this test is just to monitor the GC of our implementation. this should not allocate any memory
function benchmarkSimple(dispatcher: ContextDispatcher) {
    let id = 0;
    return () => {
        id = dispatcher.create(noop);
        dispatcher.dispatch(id, message);
        dispatcher.release(id);
    };
}

add('BaseLine realistic', benchmarkReal(new BaseLine));
add('ContextDispatcher realistic', benchmarkReal(new ContextDispatcher));
add('BaseLine simple', benchmarkSimple(new ContextDispatcher));
add('ContextDispatcher simple', benchmarkSimple(new ContextDispatcher));
add('baseline', () => undefined);

run();
