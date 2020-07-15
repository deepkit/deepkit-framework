import 'jest-extended';
import 'reflect-metadata';
import {classToMongo} from "../src/mapping";
import { SimpleModel } from './entities';

test('class-to test simple model', () => {
    expect(() => {
        const instance = classToMongo(SimpleModel as any, {
            id: '21313',
            name: 'Hi'
        });
    }).toThrow(`Could not classToMongo since target is not a class instance`);
});
