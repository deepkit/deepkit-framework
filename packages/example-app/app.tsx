import 'reflect-metadata';
import {Application, BodyValidation, Databases, http} from '@deepkit/framework';
import {entity, t, v} from '@deepkit/type';
import {Website} from './views/website';
import {ActiveRecord, Database} from '@deepkit/orm';
import {SQLiteDatabaseAdapter} from '@deepkit/sql';

@entity.name('user')
class User extends ActiveRecord {
    @t.primary.autoIncrement id?: number;
    @t created: Date = new Date;

    constructor(
        @t.validator(v.minLength(3)) public username: string
    ) {
        super();
    }
}

class SQLiteDatabase extends Database.createClass(
    'default',
    new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'),
    [User]) {
}

class AddUserDto {
    @t.validator(v.minLength(3)) username!: string;
}

async function UserList({error}: {error?: string} = {}) {
    const users = await User.query<User>().find();
    return <Website title="Users">
        <h1>Users</h1>

        <img src="/lara.jpeg" style="max-width: 100%" />
        <div style="margin: 25px 0;">
            {users.map(user => <div>#{user.id} <strong>{user.username}</strong>, created {user.created}</div>)}
        </div>

        <form action="/add" method="post">
            <input type="text" name="username" /><br/>
            {error ? <div style="color: red">Error: {error}</div> : ''}
            <button>Send</button>
        </form>
    </Website>;
}

@http.controller()
class HelloWorldController {
    @http.GET('/')
    async startPage() {
        return UserList();
    }

    @http.POST('/add')
    async add(body: AddUserDto, bodyValidation: BodyValidation) {
        if (bodyValidation.hasErrors()) return UserList({error: bodyValidation.getErrorMessageForPath('username')});

        await new User(body.username).save();
        return UserList();
    }
}

Application.run({
    providers: [],
    controllers: [HelloWorldController],
    imports: [

        Databases.for([SQLiteDatabase], {migrateOnStartup: true})
    ]
}, {debug: true});
