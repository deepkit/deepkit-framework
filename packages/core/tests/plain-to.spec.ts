import 'jest-extended'
import 'reflect-metadata';
import {SimpleModel} from "./entities";
import {mongoToClass, plainToClass} from "../src/mapper";
import {EnumType} from "..";

test('plain-to test simple model', () => {
    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(SimpleModel, {
            id: '21313',
            name: 'Hi'
        });

        expect(instance.id).toBe('21313');
        expect(instance.name).toBe('Hi');
    }
});

test('test enum labels', () => {

    enum MyEnum {
        first,
        second,
        third,
    }

    class Model {
        @EnumType(MyEnum)
        enum: MyEnum = MyEnum.third;
    }

    expect(plainToClass(Model, {enum: MyEnum.first}).enum).toBe(MyEnum.first);
    expect(plainToClass(Model, {enum: MyEnum.second}).enum).toBe(MyEnum.second);
    expect(plainToClass(Model, {enum: 0}).enum).toBe(MyEnum.first);
    expect(plainToClass(Model, {enum: 1}).enum).toBe(MyEnum.second);
    expect(plainToClass(Model, {enum: 2}).enum).toBe(MyEnum.third);

    expect(() => {
        expect(plainToClass(Model, {enum: 'first'}).enum).toBe(MyEnum.first);
    }).toThrow('Invalid ENUM given in property enum: first, valid: 0,1,2');


    class ModelWithLabels {
        @EnumType(MyEnum, true)
        enum: MyEnum = MyEnum.third;
    }
    expect(plainToClass(ModelWithLabels, {enum: MyEnum.first}).enum).toBe(MyEnum.first);
    expect(plainToClass(ModelWithLabels, {enum: MyEnum.second}).enum).toBe(MyEnum.second);
    expect(plainToClass(ModelWithLabels, {enum: 0}).enum).toBe(MyEnum.first);
    expect(plainToClass(ModelWithLabels, {enum: 1}).enum).toBe(MyEnum.second);
    expect(plainToClass(ModelWithLabels, {enum: 2}).enum).toBe(MyEnum.third);

    expect(plainToClass(ModelWithLabels, {enum: 'first'}).enum).toBe(MyEnum.first);
    expect(plainToClass(ModelWithLabels, {enum: 'second'}).enum).toBe(MyEnum.second);
    expect(plainToClass(ModelWithLabels, {enum: 'third'}).enum).toBe(MyEnum.third);

    expect(() => {
        expect(plainToClass(ModelWithLabels, {enum: 'Hi'}).enum).toBe(MyEnum.first);
    }).toThrow('Invalid ENUM given in property enum: Hi, valid: 0,1,2,first,second,third');

});