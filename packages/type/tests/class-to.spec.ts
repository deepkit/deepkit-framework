import 'jest-extended';
import 'reflect-metadata';
import {SimpleModel, SubModel} from './entities';
import {jsonSerializer} from '../src/json-serializer';
//
// test('class-to test simple model', () => {
//
//     expect(() => {
//         const instance = classToPlain(SimpleModel as any, {
//             id: '21313',
//             name: 'Hi'
//         });
//     }).toThrow(`Could not classToPlain since target is not a class instance`);
// });


test('partial', () => {
    const i = new SimpleModel('Hi');
    i.children.push(new SubModel('Foo'));

    const plain = jsonSerializer.for(SimpleModel).partialSerialize({
        name: i.name,
        children: i.children,
    });

    expect(plain).not.toBeInstanceOf(SimpleModel);
    expect((plain as any)['id']).toBeUndefined();
    expect((plain as any)['type']).toBeUndefined();
    expect(plain.name).toBe('Hi');
    expect(plain.children[0].label).toBe('Foo');
});

test('partial unknown', () => {
    const partial = jsonSerializer.for(SimpleModel).partialSerialize({
        'unknown': 'asd',
    } as any);
    expect(partial['unknown']).toBeUndefined();
});
