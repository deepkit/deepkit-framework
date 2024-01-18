// @app/server/controller.ts
import {rpc} from '@deepkit/rpc';

@rpc.controller('/main')
class MyController {
    constructor(protected database: Database) {}

    @rpc.action()
    async getUser(id: number): Promise<User> {
        return await this.database.query(User)
            .filter({id: id}).findOne();
    }
}
