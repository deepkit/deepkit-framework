import { expect, test } from '@jest/globals';
import { atomicChange, Changes } from '@deepkit/type';


test('atomic', () => {
    class Bla {
        position: number = 1;
    }

    const bla = new Bla;
    atomicChange(bla).increase('position', 5);
});

test('changes', () => {
    {
        const changes = new Changes<any>();
        expect(changes.empty).toBe(true);

        changes.replaceSet({ bla: 234 });
        expect(changes.empty).toBe(false);
    }

    {
        const changes = new Changes<any>({ $set: {} });
        expect(changes.empty).toBe(true);

        changes.set('bla', 24);
        expect(changes.empty).toBe(false);
    }

    {
        const changes = new Changes<any>({ $set: {} });
        expect(changes.empty).toBe(true);

        changes.replaceSet({});
        expect(changes.empty).toBe(true);

        changes.mergeSet({b: true});
        expect(changes.empty).toBe(false);
    }
});
