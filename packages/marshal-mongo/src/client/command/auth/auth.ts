import {MongoClientConfig} from '../../client';
import {Command} from '../command';


export interface MongoAuth {
    auth(command: Command, config: MongoClientConfig): Promise<void>;
}