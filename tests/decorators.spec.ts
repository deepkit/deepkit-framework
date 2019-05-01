import 'jest';
import {log, stack} from "../src/decorators";
import {sleep} from "../src/core";

test('test decorators @sync', async () => {

    class Test {
        public i = 0;
        public j = 0;

        public running = false;

        @stack()
        @log()
        public async increase() {
            if (this.running) {
                throw new Error('@stack should make sure the last run is already done :/');
            }
            this.running = true;
            this.i++;
            console.log('i++');
            return new Promise((resolve) => {
                setTimeout(() => {
                    console.log('timeout done');
                    this.j++;
                    this.running = false;
                    resolve();
                }, 100);
            });
        }
    }

    {
        const test = new Test();

        expect(test.i).toBe(0);
        await test.increase();
        expect(test.i).toBe(1);
        expect(test.j).toBe(1);

        await test.increase();
        expect(test.i).toBe(2);
        expect(test.j).toBe(2);
    }

    {
        const test = new Test();
        await Promise.all([test.increase(), test.increase()]);

        expect(test.i).toBe(2);
        expect(test.j).toBe(2);
    }

    {
        const test = new Test();

        expect(test.i).toBe(0);
        test.increase();
        test.increase();
        test.increase();
        expect(test.i).toBe(1);
        expect(test.j).toBe(0);

        await sleep(0.1);
        expect(test.i).toBe(2);
        expect(test.j).toBe(1);

        await sleep(0.1);
        expect(test.i).toBe(3);
        expect(test.j).toBe(2);

        await sleep(0.1);
        expect(test.i).toBe(3);
        expect(test.j).toBe(3);
    }
});
