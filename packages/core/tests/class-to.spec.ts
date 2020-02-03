import 'jest-extended'
import 'reflect-metadata';
import {CollectionWrapper, SimpleModel, StringCollectionWrapper, SubModel} from "./entities";
import {classToPlain, partialClassToPlain} from "../src/mapper";

test('class-to test simple model', () => {

    expect(() => {
        const instance = classToPlain(SimpleModel as any, {
            id: '21313',
            name: 'Hi'
        });
    }).toThrow(`Could not classToPlain since target is not a class instance`);
});


test('partial', () => {
    const i = new SimpleModel('Hi');
    i.children.push(new SubModel('Foo'));

    const plain = partialClassToPlain(SimpleModel, {
        name: i.name,
        children: i.children,
    });

    expect(plain).not.toBeInstanceOf(SimpleModel);
    expect(plain['id']).toBeUndefined();
    expect(plain['type']).toBeUndefined();
    expect(plain.name).toBe('Hi');
    expect(plain.children[0].label).toBe('Foo');
});

test('partial 2', () => {
    const i = new SimpleModel('Hi');
    i.children.push(new SubModel('Foo'));

    const plain = partialClassToPlain(SimpleModel, {
        'children.0': i.children[0],
        'stringChildrenCollection': new StringCollectionWrapper(['Foo', 'Bar']),
        'childrenCollection': new CollectionWrapper([new SubModel('Bar3')]),
        'childrenCollection.1': new SubModel('Bar4'),
        'stringChildrenCollection.0': 'Bar2',
        'childrenCollection.2.label': 'Bar5',
    });

    expect(plain['children.0'].label).toBe('Foo');
    expect(plain['stringChildrenCollection']).toEqual(['Foo', 'Bar']);
    expect(plain['stringChildrenCollection.0']).toEqual('Bar2');
    expect(plain['childrenCollection']).toEqual([{label: 'Bar3'}]);
    expect(plain['childrenCollection.1']).toEqual({label: 'Bar4'});
    expect(plain['childrenCollection.2.label']).toEqual('Bar5');
});

test('partial unknown', () => {
    const partial = partialClassToPlain(SimpleModel, {
        'unknown': 'asd',
    });
    expect(partial['unknown']).toBeUndefined();
});
