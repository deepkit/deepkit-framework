import { expect, test } from '@jest/globals';
import { typeOf } from '../../src/reflection/reflection';
import { metaAnnotation } from '../../src/reflection/type';

test('test', () => {
    type MyAnnotation = { __meta?: never & ['myAnnotation'] };
    type Username = string & MyAnnotation;
    const type = typeOf<Username>();
    const data = metaAnnotation.getForName(type, 'myAnnotation');
    expect(data).toEqual([]);
});
