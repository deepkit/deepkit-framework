import 'jest-extended'
import 'reflect-metadata';
import {Plan, SimpleModel, SubModel} from "./entities";
import {classToMongo, classToPlain, plainToClass} from "../src/mapper";

test('class-to test simple model', () => {

    expect(() => {
        const instance = classToPlain(SimpleModel, {
            id: '21313',
            name: 'Hi'
        });
    }).toThrow(`Could not classToPlain since target is not a class instance`);

    expect(() => {
        const instance = classToMongo(SimpleModel, {
            id: '21313',
            name: 'Hi'
        });
    }).toThrow(`Could not classToMongo since target is not a class instance`);
});
