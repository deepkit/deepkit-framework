import { test } from '@jest/globals';
import { typeOf } from '../../src/reflection/reflection';
import { assertType, findMember, ReflectionKind } from '../../src/reflection/type';

test('test', () => {
    class EmailService {
        private property;

        constructor() {
            this.property = 'yes';
        }
    }

    const type = typeOf<EmailService>();
    assertType(type, ReflectionKind.class);
    const property = findMember('property', type.types);
    assertType(property, ReflectionKind.property);
    assertType(property.type, ReflectionKind.unknown);
});
