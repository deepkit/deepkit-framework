import 'jest';
import {uuid} from '../src/utils';
import {getClassSchema, t} from '../src/decorators';

test('simple', () => {
    class User {
        @t id: string = uuid();

        @t username?: string;

        @t another: number = 2;

        bla = 'constructor()';

        constructor(nothing: string = '{') {
        }

        doSomething(): void {
            this.username = 'asd';
        }
    }

    const schema = getClassSchema(User);

    expect(schema.getProperty('id').hasDefaultValue).toBe(true);
    expect(schema.getProperty('username').hasDefaultValue).toBe(false);
    expect(schema.getProperty('another').hasDefaultValue).toBe(true);
});
