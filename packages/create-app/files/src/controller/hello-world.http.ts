import { MaxLength } from '@deepkit/type';
import { http } from '@deepkit/http';
import { Service } from '../app/service';

export class HelloWorldControllerHttp {
    constructor(private service: Service) {
    }

    @http.GET('/hello/:name')
    async hello(name: string & MaxLength<6> = 'World') {
        this.service.doIt();

        return `Hello ${name}!`;
    }
}
