import 'jest-extended';
import 'reflect-metadata';
import {Controller} from "@super-hornet/framework-core";
import {getControllerOptions} from "../src/decorators";

test('decorators class', () => {
    @Controller('peter')
    class MyController {

    }

    const options = getControllerOptions(MyController);
    expect(options!.name).toBe('peter');
});
