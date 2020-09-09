import 'jest';
import 'reflect-metadata';
import {t} from './decorators';
import {plainSerializer} from './plain-serializer';


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

    const plain = plainSerializer.for(User).deserialize(user);
    expect(plain.id).toBe('2');
});