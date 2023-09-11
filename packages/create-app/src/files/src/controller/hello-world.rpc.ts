import { MaxLength } from '@deepkit/type';
import { rpc } from '@deepkit/rpc';
import { Service } from '../app/service';

@rpc.controller('/main')
export class HelloWorldControllerRpc {
    constructor(private service: Service) {
    }

    @rpc.action()
    async hello(name: string & MaxLength<6> = 'World'): Promise<string> {
        this.service.doIt();

        return `Hello ${name}!`;
    }
}
