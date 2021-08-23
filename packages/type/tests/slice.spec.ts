import { expect, test } from '@jest/globals';
import { getClassSchema, getXToClassFunction, jitValidate, jsonSerializer, mixin, plainToClass, sliceClass, t } from '../index';
import 'reflect-metadata';

test('slice exclude', () => {
    const schema = t.schema({
        username: t.string,
        password: t.string,
        created: t.date,
    });

    expect(schema.hasProperty('password')).toBe(true);
    expect(schema.hasProperty('username')).toBe(true);
    expect(schema.hasProperty('created')).toBe(true);

    const pub = schema.exclude('password');
    expect(pub.hasProperty('password')).toBe(false);
    expect(pub.hasProperty('username')).toBe(true);
    expect(pub.hasProperty('created')).toBe(true);

    {
        const instance = plainToClass(pub, { username: 'Peter' });
        expect(instance.username).toBe('Peter');
        expect((instance as any).password).toBe(undefined);
    }

    {
        const instance = plainToClass(pub, { username: 'Peter', password: 'asdasd' });
        expect(instance.username).toBe('Peter');
        expect((instance as any).password).toBe(undefined);
    }

    class Model {
        @t id: number = 0;
        @t created: Date = new Date;

        constructor(@t public username: string) {
        }
    }

    const model2Schema = getClassSchema(Model).exclude('id');
    expect(model2Schema.propertyNames).toEqual(['created', 'username']);
    expect(model2Schema.getPropertiesMap().has('created')).toBe(true);
    expect(model2Schema.getPropertiesMap().has('username')).toBe(true);
    expect(model2Schema.getPropertiesMap().size).toBe(2);
    expect(model2Schema.getProperties().length).toBe(2);

    expect(model2Schema.getMethodProperties('constructor').length).toBe(1);
    expect(model2Schema.getMethodProperties('constructor')[0].name).toBe('username');

    const v = jitValidate(model2Schema);
    expect(v({username: 'Peter', created: new Date}).length).toBe(0);

    const d = getXToClassFunction(model2Schema, jsonSerializer);
    const instance = d({username: 'Peter', created: new Date});
    expect(instance).toEqual({username: 'Peter', created: new Date});
    expect(v(instance).length).toBe(0);
});

test('slice include', () => {
    const schema = t.schema({
        username: t.string,
        password: t.string,
        created: t.date,
    });

    expect(schema.hasProperty('password')).toBe(true);
    expect(schema.hasProperty('username')).toBe(true);
    expect(schema.hasProperty('created')).toBe(true);

    const pub = schema.include('username');
    expect(pub.hasProperty('password')).toBe(false);
    expect(pub.hasProperty('username')).toBe(true);
    expect(pub.hasProperty('created')).toBe(false);

    {
        const instance = plainToClass(pub, { username: 'Peter' });
        expect(instance.username).toBe('Peter');
        expect((instance as any).password).toBe(undefined);
    }

    {
        const instance = plainToClass(pub, { username: 'Peter', password: 'asdasd' });
        expect(instance.username).toBe('Peter');
        expect((instance as any).password).toBe(undefined);
    }
});

test('slice extend', () => {
    const schema = t.schema({
        username: t.string,
        password: t.string,
        created: t.date,
    });

    const pub = schema.extend({ logins: t.number.default(0) });
    expect(pub.hasProperty('logins')).toBe(true);
    expect(pub.getProperty('logins').type).toBe('number');
    expect(pub.hasProperty('password')).toBe(true);
    expect(pub.hasProperty('username')).toBe(true);
    expect(pub.hasProperty('created')).toBe(true);

    {
        const instance = plainToClass(pub, { username: 'Peter' });
        expect(instance.username).toBe('Peter');
        expect(instance.logins).toBe(0);
    }

    {
        const instance = plainToClass(pub, { username: 'Peter', logins: 10 });
        expect(instance.username).toBe('Peter');
        expect(instance.logins).toBe(10);
    }
});


test('classSlicer overwrite', () => {
    class User {
        @t.primary.autoIncrement id: number = 0;
        @t owner?: User;
    }

    {
        const plain = plainToClass(User, { owner: 'Peter' });
        expect(plain.owner).toBe(undefined);
    }

    class UserFrontend extends sliceClass(User).extend({ owner: t.string }) {
    };

    {
        //should not modify the parent
        const plain = plainToClass(User, { owner: 'Peter' });
        expect(plain.owner).toBe(undefined);
    }

    {
        const plain = plainToClass(UserFrontend, { owner: 'Peter' });
        expect(plain.owner).toBe('Peter');
    }
});

test('classSlicer serialize', () => {
    class User {
        @t.primary.autoIncrement id: number = 0;
        @t created: Date = new Date;

        constructor(
            @t.minLength(3) public username: string
        ) {
        }
    }

    class AddUserDto extends sliceClass(User).exclude('id', 'created') {
    };
    const schema = getClassSchema(AddUserDto);
    expect(schema.getProperty('username').type).toBe('string');
    expect(schema.getProperty('username').isOptional).toBe(false);

    {
        const user = plainToClass(User, { username: 'Peter' });
        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe('Peter');
    }

    {
        const user = plainToClass(AddUserDto, { username: 'Peter' });
        expect(user).toBeInstanceOf(AddUserDto);
        expect(user.username).toBe('Peter');
    }
});
test('classSlicer mixin', () => {
    class Timestampable {
        @t createdAt: Date = new Date;
        @t updatedAt: Date = new Date;
    }

    class SoftDeleted {
        @t deletedAt?: Date;
        @t deletedBy?: string;
    }

    class User extends mixin(Timestampable, SoftDeleted, t.schema({ foo: t.boolean })) {
        @t.primary.autoIncrement id: number = 0;

        constructor(
            @t.minLength(3) public username: string
        ) {
            super();
        }
    }

    const user = getClassSchema(User);
    expect(user.getProperty('createdAt').type).toBe('date');
    expect(user.getProperty('updatedAt').type).toBe('date');
    expect(user.getProperty('deletedAt').type).toBe('date');
    expect(user.getProperty('deletedBy').type).toBe('string');
    expect(user.getProperty('username').type).toBe('string');
    expect(user.getProperty('foo').type).toBe('boolean');

    class AddUserDto extends sliceClass(User).exclude('id', 'createdAt') {
    }

    const schema = getClassSchema(AddUserDto);
    expect(schema.getProperty('username').type).toBe('string');
    expect(schema.getProperty('username').isOptional).toBe(false);
    expect(schema.hasProperty('createdAt')).toBe(false);

    {
        const user = plainToClass(User, { username: 'Peter' });
        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe('Peter');
        expect(user.createdAt).toBeInstanceOf(Date);
    }

    {
        const user = plainToClass(AddUserDto, { username: 'Peter' });
        expect(user).toBeInstanceOf(AddUserDto);
        expect(user.username).toBe('Peter');
        expect((user as any).createdAt).toBe(undefined);
        expect((user as any).id).toBe(undefined);
    }
});

test('slice include', () => {
    class User {
        @t.primary.autoIncrement id: number = 0;
        @t created: Date = new Date;
        @t image?: Uint8Array;

        constructor(
            @t.minLength(3) public username: string
        ) {
        }
    }

    class UploadedFile {
    }

    class AddUserDto extends sliceClass(User).include('username') {
        @t imageUpload?: UploadedFile;
    }

    {
        const schema = getClassSchema(AddUserDto);
        expect(schema.getProperties().length).toBe(2);
        expect(schema.getProperties()[0].name).toBe('username');
        expect(schema.getProperties()[1].name).toBe('imageUpload');
    }

});
