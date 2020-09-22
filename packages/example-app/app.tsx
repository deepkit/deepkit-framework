import 'reflect-metadata';
import {Application, Databases, http, template} from '@deepkit/framework';
import {entity, t} from '@deepkit/type';
import {Website} from './views/website';
import {ActiveRecord, Database} from '@deepkit/orm';
import {SQLiteDatabaseAdapter} from '@deepkit/sql';

@entity.name('user')
class User extends ActiveRecord {
    @t.primary.autoIncrement id?: number;
    @t created: Date = new Date;

    constructor(
        @t public username: string
    ) {
        super()
    }
}

class SQLiteDatabase extends Database.createClass('sqlite', new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), [User]) {
}

@http.controller()
class HelloWorldController {
    @http.GET('/')
    async startPage() {
        const users = await User.query<User>().find();

        return <Website title="Users">
            <h1>Users</h1>
            <div>
                {users.map(user => <div>#{user.id} <strong>{user.username}</strong>, created {user.created}</div>)}
            </div>
        </Website>;
    }

    @http.GET('/add/:username')
    async add(username: string) {
        await new User(username).save();
        return <div>{username} added!</div>;
    }
}

Application.run({
    providers: [],
    controllers: [HelloWorldController],
    imports: [
        Databases.for(SQLiteDatabase)
    ]
});
