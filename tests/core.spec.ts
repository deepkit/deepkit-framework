import 'jest'
import {getPathValue, setPathValue} from "../src/core";
import 'jest-extended'

test('test getPathValue', () => {
    expect(getPathValue({
        bla: 3
    }, 'bla')).toBe(3);

    expect(getPathValue({
        bla: 3
    }, 'bla2', null)).toBe(null);

    expect(getPathValue({
    }, 'bla', 'another')).toBe('another');

});

test('test getPathValue deep', () => {
    expect(getPathValue({
        bla: {
            mowla: 5
        }
    }, 'bla.mowla')).toBe(5);

    expect(getPathValue({
        'bla.mowla': 5
    }, 'bla.mowla')).toBe(5);

    expect(getPathValue({
        bla: {
            mowla: {
                evenDeeper: true
            }
        }
    }, 'bla.mowla.evenDeeper')).toBe(true);

    expect(getPathValue({
        bla: {
            mowla: {
                evenDeeper: true
            }
        }
    }, 'bla.mowla')['evenDeeper']).toBe(true);
});

test('test setPathValue ', () => {
    {
        const obj: any = {};
        setPathValue(obj, 'bla2', 5);
        expect(obj['bla2']).toBe(5);
    }

    {
        const obj: any = {};
        setPathValue(obj, 'bla.mowla', 6);
        expect(obj['bla']['mowla']).toBe(6);
    }
});
