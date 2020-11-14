import 'jest';
import 'reflect-metadata';
import {CollectionWrapper, SimpleModel, StringCollectionWrapper, SubModel} from './entities';
import {DocumentClass} from './document-scenario/DocumentClass';
import {PageCollection} from './document-scenario/PageCollection';
import {resolvePropertyCompilerSchema} from '../src/jit';
import {getClassSchema} from '../index';
import {jsonSerializer} from '../src/json-serializer';


test('partial 2', () => {
    const instance = jsonSerializer.for(SimpleModel).patchDeserialize({
        name: 'Hi',
        'children.0.label': 'Foo'
    });

    expect(instance).not.toBeInstanceOf(SimpleModel);
    expect((instance as any)['id']).toBeUndefined();
    expect((instance as any)['type']).toBeUndefined();
    expect(instance.name).toBe('Hi');
    expect(instance['children.0.label']).toBe('Foo');

    expect(jsonSerializer.for(SimpleModel).patchDeserialize({
        'children.0.label': 2
    })).toEqual({'children.0.label': '2'});

    const i2 = jsonSerializer.for(SimpleModel).patchDeserialize({
        'children.0': {'label': 3}
    });
    expect(i2['children.0']).toBeInstanceOf(SubModel);
    expect(i2['children.0'].label).toBe('3');
});


test('partial 4', () => {
    const i2 = jsonSerializer.for(SimpleModel).patchDeserialize({
        'stringChildrenCollection.0': 4
    });
    expect(i2['stringChildrenCollection.0']).toBe('4');
});

test('partial 5', () => {
    const i2 = jsonSerializer.for(SimpleModel).patchDeserialize({
        'childrenMap.foo.label': 5
    });
    expect(i2['childrenMap.foo.label']).toBe('5');
});


test('partial 7', () => {
    const i = jsonSerializer.for(SimpleModel).patchDeserialize({
        'types.0': [7]
    });
    expect(i['types.0']).toEqual('7');
});

test('partial document', () => {
    const docParent = new DocumentClass();
    const document = jsonSerializer.for(DocumentClass).patchDeserialize({
        'pages.0.name': 5,
        'pages.0.children.0.name': 6,
        'pages.0.children': [{name: 7}],
    }, {parents: [docParent]});

    console.log('document', document);
    expect(document['pages.0.name']).toBe('5');
    expect(document['pages.0.children.0.name']).toBe('6');
    expect(document['pages.0.children']).toBeInstanceOf(PageCollection);
    expect(document['pages.0.children'].get(0).name).toBe('7');

    {
        const prop = resolvePropertyCompilerSchema(getClassSchema(DocumentClass), 'pages.0.name');
        expect(prop.type).toBe('string');
        expect(prop.resolveClassType).toBe(undefined);
        expect(prop.isPartial).toBe(false);
        expect(prop.isArray).toBe(false);
        expect(prop.isMap).toBe(false);
    }

    {
        const prop = resolvePropertyCompilerSchema(getClassSchema(DocumentClass), 'pages.0.children');
        expect(prop.type).toBe('class');
        expect(prop.resolveClassType).toBe(PageCollection);
        expect(prop.isPartial).toBe(false);
        expect(prop.isArray).toBe(false);
        expect(prop.isMap).toBe(false);
    }

    {
        const prop = resolvePropertyCompilerSchema(getClassSchema(DocumentClass), 'pages.0.children.0.name');
        expect(prop.type).toBe('string');
        expect(prop.resolveClassType).toBe(undefined);
        expect(prop.isPartial).toBe(false);
        expect(prop.isArray).toBe(false);
        expect(prop.isMap).toBe(false);
    }
});


test('partial 2', () => {
    const i = new SimpleModel('Hi');
    i.children.push(new SubModel('Foo'));

    const plain = jsonSerializer.for(SimpleModel).patchSerialize({
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
