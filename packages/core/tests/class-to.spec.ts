import 'jest-extended'
import 'reflect-metadata';
import {SimpleModel} from "./entities";
import {classToPlain} from "../src/mapper";

test('class-to test simple model', () => {

    expect(() => {
        const instance = classToPlain(SimpleModel, {
            id: '21313',
            name: 'Hi'
        });
    }).toThrow(`Could not classToPlain since target is not a class instance`);
});
