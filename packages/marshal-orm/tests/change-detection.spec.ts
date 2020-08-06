import 'jest-extended';
import 'reflect-metadata';
import {t, getClassSchema} from '@super-hornet/marshal';
import {Formatter} from '../src/formatter';
import {DatabaseQueryModel} from '../src/query';
import {buildChanges} from '../src/change-detector';
import {DatabaseSession} from '../src/database-session';

test('change-detection', () => {
    class Image {
        @t.primary id: number = 0;

        @t data: string = 'empty';
    }

    class User {
        @t.primary id: number = 0;

        @t.reference().optional image?: Image;

        constructor(@t public username: string) {
        }
    }

    const formatter = new Formatter('plain');

    // {
    //     const model = new DatabaseQueryModel<any, any, any>();
    //     const user = formatter.hydrate(getClassSchema(User), model, {username: 'Peter', id: '2'});
    //     expect(user.username).toBe('Peter');
    //     expect(user.id).toBe(2);
    //     expect(user.image).toBeUndefined();
    // }

    {
        const model = new DatabaseQueryModel<any, any, any>();
        const user = formatter.hydrate(getClassSchema(User), model, {username: 'Peter', id: '2', image: '1'});
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(2);
        expect(user.image).toBeInstanceOf(Image);
        expect(user.image.id).toBe(1);
        expect(user.image.hasOwnProperty(getClassSchema(Image).getProperty('data').symbol)).toBe(false);
        expect(() => user.image.data).toThrow(`Can not access 'data' since class Image was not completely hydrated`);

        user.username = 'Bar';
        expect(buildChanges(user)).toEqual({username: 'Bar'});

        //todo:
        // 1. create change-detection, `data` should not be included
        // 2. change `data` and re-create change-detection (since not hydrated)
        user.image.data = 'changed';
        expect(user.image.data).toBe('changed');
        expect(buildChanges(user.image)).toEqual({data: 'changed'});

        //todo: create new Reference via
        // const image = database.reference(Image, 2);
        // assigned that image to `user.image`, check if change-detection detected it.
    }

});
