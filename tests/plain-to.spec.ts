import 'jest-extended'
import 'reflect-metadata';
import {Plan, SimpleModel, SubModel} from "./entities";
import {getResolvedReflection, partialPlainToClass, plainToClass} from "../src/mapper";
import {EnumType} from "..";

test('getResolvedReflection simple', () => {
    expect(getResolvedReflection(SimpleModel, 'id')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'id')!.resolvedPropertyName).toBe('id');
    expect(getResolvedReflection(SimpleModel, 'id')!.type).toBe('uuid');
    expect(getResolvedReflection(SimpleModel, 'id')!.typeValue).toBeNull();
    expect(getResolvedReflection(SimpleModel, 'id')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'id')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'plan')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'plan')!.resolvedPropertyName).toBe('plan');
    expect(getResolvedReflection(SimpleModel, 'plan')!.type).toBe('enum');
    expect(getResolvedReflection(SimpleModel, 'plan')!.typeValue).toBe(Plan);
    expect(getResolvedReflection(SimpleModel, 'plan')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'plan')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'children')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'children')!.resolvedPropertyName).toBe('children');
    expect(getResolvedReflection(SimpleModel, 'children')!.type).toBe('class');
    expect(getResolvedReflection(SimpleModel, 'children')!.typeValue).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'children')!.array).toBe(true);
    expect(getResolvedReflection(SimpleModel, 'children')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.resolvedPropertyName).toBe('childrenMap');
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.type).toBe('class');
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.typeValue).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.map).toBe(true);
});

test('getResolvedReflection deep', () => {
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.resolvedClassType).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.resolvedPropertyName).toBe('label');
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.type).toBe('string');
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.typeValue).toBeNull();
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.resolvedClassType).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.resolvedPropertyName).toBe('label');
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.type).toBe('string');
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.typeValue).toBeNull();
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.unknown')).toBeNull();

    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.resolvedPropertyName).toBe('childrenMap');
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.type).toBe('class');
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.typeValue).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.map).toBe(false);
});


test('plain-to test simple model', () => {

    const instance = plainToClass(SimpleModel, {
        //todo, this should throw an error
        id: '21313',
        name: 'Hi'
    });

    expect(instance.id).toBe('21313');
    expect(instance.name).toBe('Hi');
});


test('partial', () => {
    const instance = partialPlainToClass(SimpleModel, {
        name: 'Hi',
        children: [
            {label: 'Foo'}
        ]
    });

    expect(instance).not.toBeInstanceOf(SimpleModel);
    expect(instance['id']).toBeUndefined();
    expect(instance['type']).toBeUndefined();
    expect(instance.name).toBe('Hi');
    expect(instance.children[0]).toBeInstanceOf(SubModel);
    expect(instance.children[0].label).toBe('Foo');
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