import 'jest-extended'
import 'reflect-metadata';
import {classToMongo} from "../src/mapping";
import {SimpleModel} from "@marcj/marshal/tests/entities";

test('class-to test simple model', () => {
    expect(() => {
        const instance = classToMongo(SimpleModel, {
            id: '21313',
            name: 'Hi'
        });
    }).toThrow(`Could not classToMongo since target is not a class instance`);
});
