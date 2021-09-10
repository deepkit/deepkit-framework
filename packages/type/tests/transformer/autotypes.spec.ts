import { expect, test } from '@jest/globals';
import { getClassSchema } from '../../src/model';
import { t } from '../../src/decorators';

test('reflection works', () => {
    class Entity {
        tags!: string[];
    }

    expect(getClassSchema(Entity).getProperty('tags').type).toBe('array');
    expect(getClassSchema(Entity).getProperty('tags').getSubType().type).toBe('string');
});

test('reflection never', () => {
    /** @reflection never */
    class Entity {
        tags!: string[];
    }

    expect(getClassSchema(Entity).getProperties().length).toBe(0);
});

test('transformer is loaded', () => {
    class Entity {
        @t tags!: string[];
    }

    expect(getClassSchema(Entity).getProperties().length).toBe(1);
    expect(getClassSchema(Entity).getProperty('tags').type).toBe('array');
    expect(getClassSchema(Entity).getProperty('tags').getSubType().type).toBe('string');
});

test('typeof types', () => {
    class Config {
        tags!: string[];
    }

    const config = new Config;

    class Controller {
        constructor(private c: typeof config) {
        }
    }

    expect(getClassSchema(Controller).getProperty('c').type).toBe('any');
    expect(getClassSchema(Controller).getProperty('c').typeValue).toBe(config);
});
