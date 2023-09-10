import { expect, test } from '@jest/globals';
import { isCustomTypeClass, isGlobalTypeClass, stringifyResolvedType, stringifyType } from '../src/lib/reflection/type.js';
import { ReflectionClass, typeOf } from '../src/lib/reflection/reflection.js';

test('index access inheritance', () => {
    interface SuperInterface {
        id: number;
    }

    interface DerivedInterface extends SuperInterface {
    }

    class SuperClass {
        id!: number;
    }

    class DerivedClass extends SuperClass {
    }

    expect(stringifyType(typeOf<SuperInterface['id']>())).toBe('number');
    expect(stringifyType(typeOf<DerivedInterface['id']>())).toBe('number');
    expect(stringifyType(typeOf<SuperClass['id']>())).toBe('number');
    expect(stringifyType(typeOf<DerivedClass['id']>())).toBe('number');
});

test('extends override constructor', () => {
    class Adapter {
    }

    class Database {
        constructor(protected adapter: Adapter) {
        }
    }

    class MyDatabase extends Database {
        constructor() {
            super(new Adapter);
        }
    }
    expect(stringifyResolvedType(typeOf<MyDatabase>())).toBe(`MyDatabase {
  protected adapter: Adapter {};
  constructor();
}`);
});

test('extends override constructor no reflection', () => {
    class Adapter {
    }

    /**
     * @reflection never
     */
    class Database {
        constructor(protected adapter: Adapter) {
        }
    }

    class MyDatabase extends Database {
        constructor() {
            super(new Adapter);
        }
    }
    expect(stringifyResolvedType(typeOf<MyDatabase>())).toBe(`MyDatabase {constructor()}`);
});

test('isGlobalTypeClass', () => {
    class MyDate {

    }
    class User {
        myDate?: MyDate;
        created: Date = new Date;
    }

    const reflection = ReflectionClass.from(User);
    expect(isGlobalTypeClass(reflection.getProperty('myDate').type)).toBe(false);
    expect(isCustomTypeClass(reflection.getProperty('myDate').type)).toBe(true);

    expect(isGlobalTypeClass(reflection.getProperty('created').type)).toBe(true);
    expect(isCustomTypeClass(reflection.getProperty('created').type)).toBe(false);
});
