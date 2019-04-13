import 'jest';
import {Controller} from "@marcj/glut-core";
import {getControllerOptions} from "../src/decorators";

test('decorators class', () => {
    @Controller('peter')
    class MyController {

    }

    const options = getControllerOptions(MyController);
    expect(options!.name).toBe('peter');
});
