import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { t } from '../src/decorators';
import { jsonSerializer } from '../src/json-serializer';
import { getClassSchema } from '../src/model';

test('has circular 1', () => {
    class Model {
        @t id: number = 0;
    }
    expect(getClassSchema(Model).hasCircularReference()).toBe(false);
});


test('has circular 3', () => {
    class Config {
    }
    class Model {
        @t id: number = 0;
        @t config?: Config;
    }
    expect(getClassSchema(Model).hasCircularReference()).toBe(false);
    expect(getClassSchema(Config).hasCircularReference()).toBe(false);
});

test('has circular 5', () => {
    class Value {
        constructor(@t.type(() => Model) model: any) {}
    }

    class Config {
        @t value!: Value;
    }

    class Model {
        @t id: number = 0;
        @t config?: Config;
    }
    expect(getClassSchema(Model).hasCircularReference()).toBe(true);
    expect(getClassSchema(Config).hasCircularReference()).toBe(true);
    expect(getClassSchema(Value).hasCircularReference()).toBe(true);
});
