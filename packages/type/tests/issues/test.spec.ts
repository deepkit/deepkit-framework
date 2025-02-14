import { expect, test } from '@jest/globals';
import { typeOf } from '../../src/reflection/reflection';
import { typeAnnotation } from '../../src/reflection/type';

test('test', () => {
    type MyAnnotation = { __meta?: never & ['myAnnotation'] };
    type Username = string & MyAnnotation;
    const type = typeOf<Username>();
    const data = typeAnnotation.getType(type, 'myAnnotation');
    expect(data).toEqual(undefined);
});
