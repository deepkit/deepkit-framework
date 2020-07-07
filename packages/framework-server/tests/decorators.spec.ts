import 'jest-extended';
import {Controller} from "@super-hornet/framework-shared";
import {getControllerOptions} from "../src/decorators";

test('decorators class', () => {
    @Controller('peter')
    class MyController {

    }

    const options = getControllerOptions(MyController);
    expect(options!.name).toBe('peter');
});
