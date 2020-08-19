import 'jest';
import 'reflect-metadata';
import {t} from './decorators';
import {classToPlain} from '../index';


test('new api', () => {
    class User extends t.class({
        id: t.string.primary
    }) {
        doIt() {
            this.id = 'asd';
        }
    }

    const user = new User();
    user.doIt();
    user.id = '2';

    const plain = classToPlain(User, user);
    expect(plain.id).toBe('2');
});