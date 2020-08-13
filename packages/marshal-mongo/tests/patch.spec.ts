import 'jest-extended';
import 'reflect-metadata';
import {patchClassToMongo, patchPlainToMongo} from '../src/mapping';
import {SimpleModel, SubModel} from './entities';
import {DocumentClass} from './document-scenario/DocumentClass';
import {PageCollection} from './document-scenario/PageCollection';
import {PageClass} from './document-scenario/PageClass';
import { patchPlainToClass } from '@super-hornet/marshal';

test('partial 2', () => {
    const instance = patchPlainToMongo(SimpleModel, {
        name: 'Hi',
        'children.0.label': 'Foo'
    });

    expect(instance).not.toBeInstanceOf(SimpleModel);
    expect(instance['id']).toBeUndefined();
    expect(instance['type']).toBeUndefined();
    expect(instance.name).toBe('Hi');
    expect(instance['children.0.label']).toBe('Foo');

    {
        expect(patchPlainToMongo(SimpleModel, {
            'children.0.label': 2
        })).toEqual({'children.0.label': '2'});

        const i = patchPlainToMongo(SimpleModel, {
            'children.0': new SubModel('3')
        });
        expect(i['children.0'].label).toBe('3');
    }

    {
        expect(patchPlainToMongo(SimpleModel, {
            'children.0.label': 2
        })).toEqual({'children.0.label': '2'});


        const ic = patchPlainToClass(SimpleModel, {
            'children.0': {label: 3}
        });
        expect(ic['children.0']).toBeInstanceOf(SubModel);
        expect(ic['children.0'].label).toBe('3');


        const im = patchClassToMongo(SimpleModel, {
            'children.0': new SubModel('3')
        });
        expect(im['children.0']).toBeObject();
        expect(im['children.0'].label).toBe('3');

        const i = patchPlainToMongo(SimpleModel, {
            'children.0': {label: 3}
        });
        expect(i['children.0']).toBeObject();
        expect(i['children.0'].label).toBe('3');

        const i2 = patchPlainToMongo(SimpleModel, {
            'children.0': {label: 3}
        });
        expect(i2['children.0'].label).toBe('3');
    }
});

test('partial 4', () => {
    {
        const i = patchPlainToMongo(SimpleModel, {
            'stringChildrenCollection.0': 4
        });
        expect(i['stringChildrenCollection.0']).toBe('4');
    }
    {
        const i = patchPlainToMongo(SimpleModel, {
            'stringChildrenCollection.0': 4
        });
        expect(i['stringChildrenCollection.0']).toBe('4');
    }
});

test('partial 5', () => {
    {
        const i = patchPlainToMongo(SimpleModel, {
            'childrenMap.foo.label': 5
        });
        expect(i['childrenMap.foo.label']).toBe('5');
    }
    {
        const i = patchPlainToMongo(SimpleModel, {
            'childrenMap.foo.label': 5
        });
        expect(i['childrenMap.foo.label']).toBe('5');
    }
});

test('partial 7', () => {
    {
        const i = patchPlainToMongo(SimpleModel, {
            'types.0': [7]
        });
        expect(i['types.0']).toEqual('7');
    }
    {
        const i = patchPlainToMongo(SimpleModel, {
            'types.0': [7]
        });
        expect(i['types.0']).toEqual('7');
    }
});

test('partial document', () => {
    {
        const doc = new DocumentClass;
        const document = patchClassToMongo(DocumentClass, {
            'pages.0.name': 5,
            'pages.0.children.0.name': 6,
            'pages.0.children': new PageCollection([new PageClass(doc, '7')])
        });
        expect(document['pages.0.name']).toBe('5');
        expect(document['pages.0.children.0.name']).toBe('6');
        expect(document['pages.0.children']).toBeInstanceOf(Array);
        expect(document['pages.0.children'][0].name).toBe('7');
    }

    {
        const doc = new DocumentClass;
        const document = patchPlainToMongo(DocumentClass, {
            'pages.0.name': 5,
            'pages.0.children.0.name': 6,
            'pages.0.children': [{name: 7}]
        }, {parents: [doc]});
        expect(document['pages.0.name']).toBe('5');
        expect(document['pages.0.children.0.name']).toBe('6');
        expect(document['pages.0.children']).toBeInstanceOf(Array);
        expect(document['pages.0.children'][0].document).toBe(undefined);
        expect(document['pages.0.children'][0].name).toBe('7');
    }
});
