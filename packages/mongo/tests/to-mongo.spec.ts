import 'jest-extended';
import 'reflect-metadata';
import {
  BinaryType,
  classToPlain,
  EnumType,
  getReflectionType,
  getResolvedReflection,
  MongoIdType,
  plainToClass,
  UUIDType,
} from '@marcj/marshal';
import { Plan, SimpleModel, SubModel } from '@marcj/marshal/tests/entities';
import { Binary, ObjectID } from 'mongodb';
import {
  classToMongo,
  mongoToClass,
  partialClassToMongo,
  partialPlainToMongo,
} from '../src/mapping';
import { Buffer } from 'buffer';
import { DocumentClass } from '@marcj/marshal/tests/document-scenario/DocumentClass';
import { PageCollection } from '@marcj/marshal/tests/document-scenario/PageCollection';
import { PageClass } from '@marcj/marshal/tests/document-scenario/PageClass';

test('test simple model', () => {
  const instance = new SimpleModel('myName');
  const mongo = classToMongo(SimpleModel, instance);

  expect(mongo['id']).toBeInstanceOf(Binary);
  expect(mongo['name']).toBe('myName');
});

test('test simple model all fields', () => {
  const instance = new SimpleModel('myName');
  instance.plan = Plan.PRO;
  instance.type = 5;
  instance.created = new Date('Sat Oct 13 2018 14:17:35 GMT+0200');
  instance.children.push(new SubModel('fooo'));
  instance.children.push(new SubModel('barr'));

  instance.childrenMap.foo = new SubModel('bar');
  instance.childrenMap.foo2 = new SubModel('bar2');

  const mongo = classToMongo(SimpleModel, instance);

  expect(mongo['id']).toBeInstanceOf(Binary);
  expect(mongo['name']).toBe('myName');
  expect(mongo['type']).toBe(5);
  expect(mongo['plan']).toBe(Plan.PRO);
  expect(mongo['created']).toBeDate();
  expect(mongo['children']).toBeArrayOfSize(2);
  expect(mongo['children'][0]).toBeObject();
  expect(mongo['children'][0].label).toBe('fooo');
  expect(mongo['children'][1].label).toBe('barr');

  expect(mongo['childrenMap']).toBeObject();
  expect(mongo['childrenMap'].foo).toBeObject();
  expect(mongo['childrenMap'].foo.label).toBe('bar');
  expect(mongo['childrenMap'].foo2.label).toBe('bar2');
});

test('convert IDs and invalid values', () => {
  enum Enum {
    first,
    second,
  }

  class Model {
    @MongoIdType()
    id2?: string;

    @UUIDType()
    uuid?: string;

    @EnumType(Enum)
    enum?: Enum;
  }

  const instance = new Model();
  instance.id2 = '5be340cb2ffb5e901a9b62e4';

  const mongo = classToMongo(Model, instance);
  expect(mongo.id2).toBeInstanceOf(ObjectID);
  expect(mongo.id2.toHexString()).toBe('5be340cb2ffb5e901a9b62e4');

  expect(() => {
    const instance = new Model();
    instance.id2 = 'notavalidId';
    const mongo = classToMongo(Model, instance);
  }).toThrow('Invalid ObjectID given in property');

  expect(() => {
    const instance = new Model();
    instance.uuid = 'notavalidId';
    const mongo = classToMongo(Model, instance);
  }).toThrow('Invalid UUID given in property');
});

test('binary', () => {
  class Model {
    @BinaryType()
    preview: Buffer = new Buffer('FooBar', 'utf8');
  }

  const i = new Model();
  expect(i.preview.toString('utf8')).toBe('FooBar');

  const mongo = classToMongo(Model, i);
  expect(mongo.preview).toBeInstanceOf(Binary);
  expect((mongo.preview as Binary).length()).toBe(6);
});

test('binary from mongo', () => {
  class Model {
    @BinaryType()
    preview: Buffer = new Buffer('FooBar', 'utf8');
  }

  const i = mongoToClass(Model, {
    preview: new Binary(new Buffer('FooBar', 'utf8')),
  });

  expect(i.preview.length).toBe(6);
  expect(i.preview.toString('utf8')).toBe('FooBar');
});

test('partial 2', () => {
  const instance = partialClassToMongo(SimpleModel, {
    name: 'Hi',
    'children.0.label': 'Foo',
  });

  expect(instance).not.toBeInstanceOf(SimpleModel);
  expect(instance['id']).toBeUndefined();
  expect(instance['type']).toBeUndefined();
  expect(instance.name).toBe('Hi');
  expect(instance['children.0.label']).toBe('Foo');

  {
    expect(
      partialClassToMongo(SimpleModel, {
        'children.0.label': 2,
      })
    ).toEqual({ 'children.0.label': '2' });

    const i = partialClassToMongo(SimpleModel, {
      'children.0': new SubModel('3'),
    });
    expect(i['children.0'].label).toBe('3');
  }

  {
    expect(
      partialPlainToMongo(SimpleModel, {
        'children.0.label': 2,
      })
    ).toEqual({ 'children.0.label': '2' });

    const i = partialPlainToMongo(SimpleModel, {
      'children.0': { label: 3 },
    });
    expect(i['children.0'].label).toBe('3');
  }
});

test('partial 3', () => {
  {
    const i = partialClassToMongo(SimpleModel, {
      children: [new SubModel('3')],
    });
    expect(i['children'][0].label).toBe('3');
  }

  {
    const i = partialPlainToMongo(SimpleModel, {
      children: [{ label: 3 }],
    });
    expect(i['children'][0].label).toBe('3');
  }
});

test('partial with required', () => {
  {
    expect(() => {
      partialPlainToMongo(SimpleModel, {
        children: [{}],
      });
    }).toThrow(
      'Missing value for SubModel::children. Can not convert to mongo'
    );
  }
});

test('partial 4', () => {
  {
    const i = partialClassToMongo(SimpleModel, {
      'stringChildrenCollection.0': 4,
    });
    expect(i['stringChildrenCollection.0']).toBe('4');
  }
  {
    const i = partialPlainToMongo(SimpleModel, {
      'stringChildrenCollection.0': 4,
    });
    expect(i['stringChildrenCollection.0']).toBe('4');
  }
});

test('partial 5', () => {
  {
    const i = partialClassToMongo(SimpleModel, {
      'childrenMap.foo.label': 5,
    });
    expect(i['childrenMap.foo.label']).toBe('5');
  }
  {
    const i = partialPlainToMongo(SimpleModel, {
      'childrenMap.foo.label': 5,
    });
    expect(i['childrenMap.foo.label']).toBe('5');
  }
});

test('partial 6', () => {
  {
    const i = partialClassToMongo(SimpleModel, {
      types: [6, 7],
    });
    expect(i['types']).toEqual(['6', '7']);
  }
  {
    const i = partialPlainToMongo(SimpleModel, {
      types: [6, 7],
    });
    expect(i['types']).toEqual(['6', '7']);
  }
});

test('partial 7', () => {
  {
    const i = partialClassToMongo(SimpleModel, {
      'types.0': [7],
    });
    expect(i['types.0']).toEqual('7');
  }
  {
    const i = partialPlainToMongo(SimpleModel, {
      'types.0': [7],
    });
    expect(i['types.0']).toEqual('7');
  }
});

test('partial document', () => {
  const doc = new DocumentClass();
  const document = partialClassToMongo(DocumentClass, {
    'pages.0.name': 5,
    'pages.0.children.0.name': 6,
    'pages.0.children': new PageCollection([new PageClass(doc, '7')]),
  });
  expect(document['pages.0.name']).toBe('5');
  expect(document['pages.0.children.0.name']).toBe('6');
  expect(document['pages.0.children']).toBeInstanceOf(Array);
  expect(document['pages.0.children'][0].name).toBe('7');

  expect(getResolvedReflection(DocumentClass, 'pages.0.name')).toEqual({
    resolvedClassType: PageClass,
    resolvedPropertyName: 'name',
    type: 'string',
    typeValue: null,
    array: false,
    map: false,
  });

  expect(getResolvedReflection(DocumentClass, 'pages.0.children')).toEqual({
    resolvedClassType: PageClass,
    resolvedPropertyName: 'children',
    type: 'class',
    typeValue: PageCollection,
    array: false,
    map: false,
  });

  expect(
    getResolvedReflection(DocumentClass, 'pages.0.children.0.name')
  ).toEqual({
    resolvedClassType: PageClass,
    resolvedPropertyName: 'name',
    type: 'string',
    typeValue: null,
    array: false,
    map: false,
  });
});
