import {Command} from './command';


export class EmptyCommand extends Command {
    execute(): Promise<any> {
        return Promise.resolve(undefined);
    }

    needsWritableHost(): boolean {
        return false;
    }

}