import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {f, getClassSchema, uuid} from "@marcj/marshal";
import {EntityRegistry} from "..";
import {sleep} from '@marcj/estdlib';
import * as weak from 'weak-napi';

class EntityA {
    @f.uuid().primary() id: string = uuid();
}

function watch(item: any) {
    return weak(item, function () {
        console.log('DELETED');
    })
}

test('weak', async () => {
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 25; j++) {
            const obj: any = {
                a: true,
                foo: 'bar',
                buffer: Buffer.alloc(1024 * 1024 * 5) //5mb
            };
            watch(obj);
        }
        await sleep(0.1);
    }
});

test('store', async () => {
    const entityRegistry = new EntityRegistry();
    const classSchema = getClassSchema(EntityA);
    let id = '';

    let item: any = new EntityA();
    id = item.id;
    entityRegistry.store(classSchema, item);
    item = undefined;

    //create some trash, to trigger GC
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 50; j++) {
            const obj: any = {
                a: true,
                foo: 'bar',
                buffer: Buffer.alloc(1024 * 1024 * 5) //5mb
            };
        }
        await sleep(0.1);
    }

    expect(entityRegistry.isKnownByPk(classSchema, id)).toBeFalse();
});
