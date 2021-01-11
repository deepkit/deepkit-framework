#!/usr/bin/env -S node --no-warnings --experimental-specifier-resolution=node --loader @deepkit/framework/loader
import 'reflect-metadata';
import { entity, sliceClass, t } from '@deepkit/type';
import { Application, BodyValidation, http, KernelModule, Logger, Redirect } from '@deepkit/framework';
import { Website } from './views/website';
import { ActiveRecord, Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sql';

@entity.name('user')
class User extends ActiveRecord {
    @t.primary.autoIncrement id?: number;
    @t created: Date = new Date;

    constructor(
        @t.minLength(3) public username: string
    ) {
        super();
    }
}

class SQLiteDatabase extends Database {
    constructor() {
        super(new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), [User]);
    }
}

class AddUserDto extends sliceClass(User).exclude('id', 'created') { };

async function UserList({ error }: { error?: string } = {}) {
    const users = await User.query().find();
    return <Website title="Users">
        <h1>Users</h1>

        <img src="/lara.jpeg" style="max-width: 100%" />
        <div style="margin: 25px 0;">
            {users.map(user => <div>#{user.id} <strong>{user.username}</strong>, created {user.created}</div>)}
        </div>

        <form action="/add" method="post">
            <input type="text" name="username" /><br />
            {error ? <div style="color: red">Error: {error}</div> : ''}
            <button>Send</button>
        </form>
    </Website>;
}

@http.controller()
class HelloWorldController {
    constructor(protected logger: Logger) {
    }

    @http.GET('/').name('startPage').description('List all users')
    startPage() {
        this.logger.log('Hi!');
        return <UserList />;
    }

    @http.GET('/api/users')
    async users() {
        return await User.query().find();
    }

    @http.POST('/add').description('Adds a new user')
    async add(@http.body() body: AddUserDto, bodyValidation: BodyValidation) {
        if (bodyValidation.hasErrors()) return <UserList error={bodyValidation.getErrorMessageForPath('username')} />;

        await new User(body.username).save();
        return Redirect.toRoute('startPage');
    }

    @http.GET('/my-getter')
    async get2(@http.query() peter: string) {
        return peter;
    }
}

Application.create({
    providers: [],
    controllers: [HelloWorldController],
    imports: [
        KernelModule.configure({
            workers: 1, debug: true, publicDir: 'public', httpLog: true,
            databases: [SQLiteDatabase], migrateOnStartup: true
        }),
    ]
}).run();
