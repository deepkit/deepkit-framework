import 'jest-extended';
import 'reflect-metadata';
import {
    StringType,
    uuid,
    Entity,
} from '@marcj/marshal';
import {
    now,
    SimpleModel,
    Plan,
    SubModel,
    CollectionWrapper,
    StringCollectionWrapper,
} from '@marcj/marshal/tests/entities';
import {
    ClassWithUnmetParent,
    DocumentClass,
    ImpossibleToMetDocumentClass,
} from '@marcj/marshal/tests/document-scenario/DocumentClass';
import { PageCollection } from '@marcj/marshal/tests/document-scenario/PageCollection';
import { PageClass } from '@marcj/marshal/tests/document-scenario/PageClass';
import { plainToTypeOrm, classToEntitySchema } from '../src/mapping';
import { EntitySchema } from 'typeorm';

test('classToEntitySchema', () => {
    @Entity('user')
    class User {
        @StringType()
        id: string = uuid();
    }
    const typeormEntry = classToEntitySchema(User);

    expect(typeormEntry).toBeInstanceOf(EntitySchema);
    expect(typeormEntry.options.name).toEqual('user');
    expect(typeormEntry.options.columns.id!.type).toEqual(String);
});
