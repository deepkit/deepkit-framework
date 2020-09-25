import 'jest';
import {atomicChange} from '../src/changes';


test('atomic', () => {
    class Bla {
        position: number = 1;
    }

    const bla = new Bla;
    console.log('bla.position', bla.position);
    atomicChange(bla).increase('position', 5);
    console.log('bla.position', bla.position);
});
