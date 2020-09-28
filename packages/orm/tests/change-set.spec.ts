import 'jest';
import {atomicChange, Changes} from '../src/changes';


test('atomic', () => {
    class Bla {
        position: number = 1;
    }

    const bla = new Bla;
    console.log('bla.position', bla.position);
    atomicChange(bla).increase('position', 5);
    console.log('bla.position', bla.position);
});

test('changes', () => {
    {
        const changes = new Changes<any>();
        expect(changes.empty).toBe(true);

        changes.replaceSet({bla: 234});
        expect(changes.empty).toBe(false);
    }

    {
        const changes = new Changes<any>({$set: {}});
        expect(changes.empty).toBe(true);

        changes.set('bla', 24);
        expect(changes.empty).toBe(false);
    }

    {
        const changes = new Changes<any>({$set: {}});
        expect(changes.empty).toBe(true);

        changes.replaceSet({});
        expect(changes.empty).toBe(true);
    }
});
