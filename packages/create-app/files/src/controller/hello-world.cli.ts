import { MaxLength } from '@deepkit/type';
import { cli, arg } from '@deepkit/app';
import { Logger } from '@deepkit/logger';
import { Service } from '../app/service';

@cli.controller('hello')
export class HelloWorldControllerCli {
    constructor(private logger: Logger, private service: Service) {
    }

    async execute(@arg name: string & MaxLength<6> = 'World') {
        this.service.doIt();
        this.logger.log(`Hello ${name}!`);
    }
}
