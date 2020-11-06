import 'reflect-metadata';
import {Application, Databases, http} from '@deepkit/framework';
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
        super();
    }
}

class SQLiteDatabase extends Database.createClass(
    'sqlite',
    new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'),
    [User]) {
}

class AddUserDto {
    @t username!: string;
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

            <form action="/add" method="POST">
                <input type="text" name="username"></input><br/>
                <button>Send</button>
            </form>
        </Website>;
    }

    @http.POST('/add')
    async add(body: AddUserDto) {
        await new User(body.username).save();
        return this.startPage();
    }
}

Application.run({
    providers: [],
    controllers: [HelloWorldController],
    imports: [
        Databases.for([SQLiteDatabase], {migrateOnStartup: true})
    ]
});
