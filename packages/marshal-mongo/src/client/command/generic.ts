import {Command} from './command';
import {ClassSchema} from '@super-hornet/marshal';
import {ClassType} from '@super-hornet/core';

export class GenericCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(protected cmd: any) {
        super();
    }

    async execute(config): Promise<number> {
        return await this.sendAndWait(undefined, this.cmd);
    }

    needsWritableHost(): boolean {
        return true;
    }
}