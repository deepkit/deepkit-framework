import { http } from '@deepkit/http';
import { float } from '@deepkit/type';

@http.controller()
export class TestController {
    @http.GET()
    version(): float {
        return Math.random();
    }
}
