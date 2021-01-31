#!/usr/bin/env ts-node
import 'reflect-metadata';
import {
    Application,
    BodyValidation,
    http,
    injectable,
    KernelModule,
    Logger,
    Redirect,
} from '@deepkit/framework';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, sliceClass, t } from '@deepkit/type';
import { Website } from './views/website';


@entity.name('user')
class User {
    @t.primary.autoIncrement id: number = 0;
    @t created: Date = new Date;

    constructor(
        @t.minLength(3) public username: string
    ) { }
}

class SQLiteDatabase extends Database {
    constructor() {
        super(new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), [User]);
    }
}

class AddUserDto extends sliceClass(User).exclude('id', 'created') { }

@injectable()
class UserList {
    constructor(
        protected props: { error?: string } = {},
        protected children: any[],
        protected database: SQLiteDatabase
    ) { }

    async render() {
        const users = await this.database.query(User).find();
        return <Website title="Users">
            <h1>Users</h1>

            <img src="/lara.jpeg" style="max-width: 100%" />
            <div style="margin: 25px 0;">
                {users.map(user => <div>#{user.id} <strong>{user.username}</strong>, created {user.created}</div>)}
            </div>

            <form action="/add" method="post">
                <input type="text" name="username" /><br />
                {this.props.error ? <div style="color: red">Error: {this.props.error}</div> : ''}
                <button>Send</button>
            </form>
        </Website>;
    }
}

@http.controller()
class HelloWorldController {
    constructor(protected logger: Logger, protected database: SQLiteDatabase) {
    }

    @http.GET('/').name('startPage').description('List all users')
    startPage() {
        this.logger.log('Hi!');
        return <UserList />;
    }

    @http.GET('/api/users')
    async users() {
        return await this.database.query(User).find();
    }

    @http.GET('/benchmark')
    benchmark() {
        return 'hi';
    }

    @http.POST('/add').description('Adds a new user')
    async add(@http.body() body: AddUserDto, bodyValidation: BodyValidation) {
        if (bodyValidation.hasErrors()) return <UserList error={bodyValidation.getErrorMessageForPath('username')} />;

        const user = new User(body.username);
        await this.database.persist(user);

        return Redirect.toRoute('startPage');
    }

    @http.GET('/path/:name')
    async urlParam(name: string) {
        return name;
    }

    @http.GET('/query')
    async queryParam(@http.query() peter: string) {
        return peter;
    }
}

Application.create({
    controllers: [HelloWorldController],
    imports: [
        KernelModule.configure({
            workers: 1, debug: true, publicDir: 'public', httpLog: false,
            databases: [SQLiteDatabase], migrateOnStartup: true
        }),
    ]
}).run();
