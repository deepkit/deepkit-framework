import 'jest-extended'
import 'reflect-metadata';
import {createConnection} from "typeorm";
import {Plan, SimpleModel, SuperSimple} from "@marcj/marshal/tests/entities";
import {getTypeOrmEntity} from "../src/typeorm";
import {PageClass} from "@marcj/marshal/tests/document-scenario/PageClass";

test('basic SuperSimple', async () => {
    const entity = getTypeOrmEntity(SuperSimple);

    expect(entity.options.name).toBe('SuperSimple');
    expect(entity.options.columns._id).toEqual({
        name: '_id',
        type: 'string',
        objectId: true,
        enum: undefined,
        primary: true,
        nullable: false
    });

    expect(entity.options.columns.name).toEqual({
        name: 'name',
        type: 'string',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });
});

test('basic PageClass', async () => {
    const entity = getTypeOrmEntity(PageClass);

    expect(entity.options.name).toBe('PageClass');

    expect(entity.options.columns.id).toEqual({
        name: 'id',
        type: 'uuid',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });
    expect(entity.options.columns.picture).toEqual({
        name: 'picture',
        type: 'binary',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });
    expect(entity.options.columns.parent).toBeUndefined()
});

test('basic SimpleModel', async () => {
    const entity = getTypeOrmEntity(SimpleModel);

    expect(entity.options.indices![1]).toEqual({
        columns: ['name', 'type'],
        name: 'name_type',
        unique: true
    });

    expect(entity.options.indices![0]).toEqual({
        columns: ['name'],
        name: 'name',
    });

    expect(entity.options.name).toBe('SimpleModel');
    expect(entity.options.columns.id).toEqual({
        name: 'id',
        type: 'uuid',
        objectId: false,
        enum: undefined,
        primary: true,
        nullable: false
    });

    expect(entity.options.columns.name).toEqual({
        name: 'name',
        type: 'string',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });

    expect(entity.options.columns.plan).toEqual({
        name: 'plan',
        type: 'enum',
        objectId: false,
        enum: [Plan.DEFAULT, Plan.PRO, Plan.ENTERPRISE],
        primary: false,
        nullable: false
    });

    expect(entity.options.columns.type).toEqual({
        name: 'type',
        type: 'number',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });


    expect(entity.options.columns.created).toEqual({
        name: 'created',
        type: 'date',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });

    expect(entity.options.columns.children).toEqual({
        name: 'children',
        type: 'json',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });

    expect(entity.options.columns.childrenMap).toEqual({
        name: 'childrenMap',
        type: 'json',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });

    expect(entity.options.columns.childrenCollection).toEqual({
        name: 'childrenCollection',
        type: 'json',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });

    expect(entity.options.columns.stringChildrenCollection).toEqual({
        name: 'stringChildrenCollection',
        type: 'json',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });


    expect(entity.options.columns.yesNo).toEqual({
        name: 'yesNo',
        type: 'boolean',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });

    expect(entity.options.columns.notMapped).toBeUndefined();
    expect(entity.options.columns.excluded).toBeUndefined();
    expect(entity.options.columns.excludedForMongo).toBeUndefined();

    expect(entity.options.columns.excludedForPlain).toEqual({
        name: 'excludedForPlain',
        type: 'string',
        objectId: false,
        enum: undefined,
        primary: false,
        nullable: false
    });
});


test('test actual sync', async () => {
    const entity = getTypeOrmEntity(SimpleModel);

    const connection = await createConnection({
        type: "mongodb",
        host: "localhost",
        port: 27017,
        database: "test",
        useNewUrlParser: true,
        synchronize: true,
        entities: [entity]
    });

    // await connection.connect();
    const indexes = await connection.mongoManager.queryRunner.collectionIndexes('simple_model');
    console.log('indexes', indexes);
    expect(indexes.length).toBe(3);
    expect(indexes[0].key).toEqual({_id: 1});

    expect(indexes[1].key).toEqual({name: 1});
    expect(indexes[1].unique).toBeUndefined();

    expect(indexes[2].key).toEqual({name: 1, type: 1});
    expect(indexes[2].unique).toBeTrue();
});
