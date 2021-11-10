import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { entity, t } from '../src/decorators';
import { getClassSchema } from '../src/model';
import { findCommonDiscriminant, findCommonLiteral } from '../src/inheritance';
import { getClassName } from '../../core';


test('overwrite', () => {
    class A {
        @t title!: string;
    }

    class B extends A {
    }

    class C extends A {
        @t.mongoId title!: string;
    }

    class D extends A {
        @t.uuid title!: string;
    }

    class E extends A {
        @t.literal('asd') title!: 'ads';
    }

    class F extends D {
        @t.literal('asd') title!: 'ads';
    }

    expect(getClassSchema(A).getProperty('title').type).toBe('string');
    expect(getClassSchema(B).getProperty('title').type).toBe('string');
    expect(getClassSchema(C).getProperty('title').type).toBe('objectId');
    expect(getClassSchema(D).getProperty('title').type).toBe('uuid');
    expect(getClassSchema(E).getProperty('title').type).toBe('literal');
    expect(getClassSchema(F).getProperty('title').type).toBe('literal');
});

@entity.collectionName('person')
abstract class Person {
    @t.primary.autoIncrement id: number = 0;
    @t firstName?: string;
    @t lastName?: string;
    @t abstract type: string;
}

@entity.singleTableInheritance()
class Employee extends Person {
    @t email?: string;
    @t.literal('employee') type: 'employee' = 'employee';
}

@entity.singleTableInheritance()
class Freelancer extends Person {
    @t budget: number = 10_000;

    @t.literal('freelancer') type: 'freelancer' = 'freelancer';
}

test('super class', () => {
    const employee = getClassSchema(Employee);
    const freelancer = getClassSchema(Freelancer);
    const person = getClassSchema(Person);

    expect(employee.collectionName).toBe('person');
    expect(employee.superClass).toBe(person);
    expect(!!employee.singleTableInheritance).toBe(true);
    expect(employee.getProperties().length).toBe(5);
    expect(employee.getProperty('type').literalValue).toBe('employee');
    expect(employee.subClasses.length).toBe(0);
    expect(employee.hasSingleTableInheritanceSubClasses()).toBe(false);

    expect(freelancer.collectionName).toBe('person');
    expect(freelancer.superClass).toBe(person);
    expect(!!freelancer.singleTableInheritance).toBe(true);
    expect(freelancer.getProperties().length).toBe(5);
    expect(freelancer.getProperty('type').literalValue).toBe('freelancer');
    expect(freelancer.subClasses.length).toBe(0);
    expect(freelancer.hasSingleTableInheritanceSubClasses()).toBe(false);

    expect(person.collectionName).toBe('person');
    expect(person.subClasses.length).toBe(2);
    expect(person.subClasses[0]).toBe(employee);
    expect(person.subClasses[1]).toBe(freelancer);
    expect(employee.superClass === person).toBe(true);
    expect(person.getProperty('type').type).toBe('string');
    expect(person.hasSingleTableInheritanceSubClasses()).toBe(true);
});

test('common discriminants', () => {
    class A {
        @t id!: number;
        @t.discriminant type!: string;
    }

    class B {
        @t uuid!: string;
        @t.discriminant type!: string;
    }

    expect(findCommonDiscriminant([getClassSchema(A), getClassSchema(B)])).toBe('type');
});


test('no discriminants', () => {
    class A {
        @t id!: number;
        @t type!: string;
    }

    class B {
        @t uuid!: string;
        @t type!: string;
    }

    expect(findCommonDiscriminant([getClassSchema(A), getClassSchema(B)])).toBe(undefined);
});


test('invalid discriminants 1', () => {
    class A {
        @t id!: number;
        @t.discriminant type!: string;
    }

    class B {
        @t uuid!: string;
        @t type!: string;
    }

    expect(() => findCommonDiscriminant([getClassSchema(A), getClassSchema(B)])).toThrowError(`A has a discriminant on 'type' but B has none.`);
});


test('invalid discriminants 2', () => {
    class A {
        @t id!: number;
        @t.discriminant type!: string;
    }

    class B {
        @t.discriminant uuid!: string;
        @t type!: string;
    }

    expect(() => findCommonDiscriminant([getClassSchema(A), getClassSchema(B)])).toThrowError(`A has a discriminant on 'type' but B has one on 'uuid'`);
});

test('common literals', () => {
    class A {
        @t id!: number;
        @t.literal('a') type!: string;
    }

    class B {
        @t uuid!: string;
        @t.literal('b') type!: string;
    }

    expect(findCommonLiteral([getClassSchema(A), getClassSchema(B)])).toBe('type');
});

test('same common literals', () => {
    class A {
        @t id!: number;
        @t.literal('a') type!: string;
    }

    class B {
        @t uuid!: string;
        @t.literal('a') type!: string;
    }

    expect(() => findCommonLiteral([getClassSchema(A), getClassSchema(B)])).toThrowError(`B has a literal on type that is already used by A.`);
});

test('no common literals', () => {
    class A {
        @t id!: number;
        @t.literal('a') type!: string;
    }

    class B {
        @t uuid!: string;
        @t type!: string;
    }

    expect(findCommonLiteral([getClassSchema(A), getClassSchema(B)])).toBe(undefined);
});


test('super class discriminant', () => {
    abstract class Person {
        @t.primary.autoIncrement id: number = 0;
        @t firstName?: string;
        @t lastName?: string;
        @t.discriminant abstract type: string;
    }

    @entity.singleTableInheritance()
    class Employee extends Person {
        @t email?: string;
        @t type: 'employee' = 'employee';
    }

    @entity.singleTableInheritance()
    class Freelancer extends Person {
        @t budget: number = 10_000;
        @t type: 'freelancer' = 'freelancer';
    }

    expect(findCommonDiscriminant([getClassSchema(Employee), getClassSchema(Freelancer)])).toBe('type');

    expect(getClassSchema(Person).getSingleTableInheritanceDiscriminant().name).toBe('type');
});

test('classType name', () => {
    class BaseClass {
        @t hello: string = 'world';
    }

    class Clazz extends BaseClass {
        @t foo: string = 'bar';
    }

    expect(getClassName(Clazz)).toBe('Clazz');
    expect(getClassSchema(Clazz).getClassName()).toBe('Clazz');
    expect(getClassSchema(Clazz).clone().getClassName()).toBe('Clazz');
});
