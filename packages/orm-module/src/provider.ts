import {Database} from '@deepkit/orm/dist';
import {ClassType} from '@deepkit/core';

export class DatabaseProvider {
    constructor(
        public databases: ClassType<Database<any>>[]
    ) {
    }
}
