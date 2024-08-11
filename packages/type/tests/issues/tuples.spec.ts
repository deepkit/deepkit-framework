import { expect, test } from '@jest/globals';
import { cast, validate } from '@deepkit/type';

test('cast literal obj having typed tuple [number | null, number | null] as nested prop', () => {
    type MinMax = [number | null, number | null];

    class T {
        building!: {
            area: MinMax
        };
    }

    // const d = JSON.parse('{"building":{"area":[120,null]}}');
    const d = {
        building: {
            area: [120, null],
        },
    };

    const errors = validate<T>(d);
    expect(errors.length).toBe(0);

    const casted: T = cast<T>(d);

    expect(casted.building.area[0]).toBe(120);
    expect(casted.building.area[1]).toBe(null);
});

test('cast literal obj to T containing typed tuple', () => {
    type SomeData = [string | null, string, string | null];

    class T {
        tuple!: SomeData;
    }

    const d = {
        tuple: [null, 'z', null],
    };

    const errors = validate<T>(d);
    expect(errors.length).toBe(0);

    const casted: T = cast<T>(d);

    expect(casted.tuple[0]).toBe(null);
    expect(casted.tuple[1]).toBe('z');
    expect(casted.tuple[2]).toBe(null);
});

test("cast literal obj having typed tuple [number | null, number | null] as nested prop", () => {
    type MinMax = [min: number | null, max: number | null];

    class T {
        building?: {
            area?: MinMax
        }
    }

    // const d = JSON.parse('{"building":{"area":[120,null]}}');

    const data: T = cast<T>({
        building: {
            area: [120, null]
        }
    });

    const errors = validate<T>(data);
    expect(errors.length).toBe(0);
});
