import 'jest';
import 'jest-extended';
import {createClassSchema, f} from "../src/decorators";
import {plainToClass} from "../src/mapper";

test('external Class', () => {
    class Timestamp {
        seconds: number = 0;
        nanoseconds: number = 0;

        constructor(s: number, n: number) {
            this.seconds = s;
            this.nanoseconds = n;
        }
    }

    const schema = createClassSchema(Timestamp);

    f.type(Number).asName('seconds')(schema.classType, 'constructor', 0);
    f.type(Number).asName('nanoseconds')(schema.classType, 'constructor', 1);

    expect(schema.getProperty('seconds').type).toBe('number');
    expect(schema.getProperty('nanoseconds').type).toBe('number');

    const timestamp = plainToClass(Timestamp, {seconds: 123, nanoseconds: 5});

    expect(timestamp.seconds).toBe(123);
    expect(timestamp.nanoseconds).toBe(5);
});
