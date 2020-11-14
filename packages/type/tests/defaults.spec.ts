import 'jest';
import {uuid} from '../src/utils';
import {getClassSchema, t} from '../index';

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


test('simple ie11 fake-class', () => {
    var User = /** @class */ (function () {
        function Children() {
            //@ts-ignore
            this.id = uuid();

            //@ts-ignore
            this.bar = 'constructor()';

            //@ts-ignore
            this.another = 2;

            //@ts-ignore
            this.nothing = '{'
        }

        Children.prototype.doSomething = function () {
            this.username = 'asdsad';
        };

        t.type(String)(Children, 'id');
        t.type(String)(Children, 'username');
        t.type(Number)(Children, 'another');

        return Children;
    }());

    const schema = getClassSchema(User);

    expect(schema.getProperty('id').hasDefaultValue).toBe(true);
    expect(schema.getProperty('username').hasDefaultValue).toBe(false);
    expect(schema.getProperty('another').hasDefaultValue).toBe(true);
});

