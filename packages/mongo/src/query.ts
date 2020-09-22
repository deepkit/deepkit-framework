import {DatabaseSession, Entity, GenericQuery} from '@deepkit/orm';
import {MongoQueryModel} from './query.model';
import {MongoQueryResolver} from './query.resolver';
import {ClassSchema} from '@deepkit/type';

export class MongoDatabaseQuery<T extends Entity,
    MODEL extends MongoQueryModel<T> = MongoQueryModel<T>> extends GenericQuery<T, MongoQueryResolver<T>> {
    protected resolver = new MongoQueryResolver(this.classSchema, this.databaseSession);

    constructor(classSchema: ClassSchema<T>, protected databaseSession: DatabaseSession<any>) {
        super(classSchema, databaseSession);
        if (!databaseSession.withIdentityMap) this.disableIdentityMap();
    }

}
