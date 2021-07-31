#!/usr/bin/env ts-node-script
import 'reflect-metadata';
import { Application, KernelModule } from '@deepkit/framework';
import { BodyValidation, http, Redirect } from '@deepkit/http';
import { injectable } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, sliceClass, t } from '@deepkit/type';
import { Website } from './views/website';
import { cli, Command } from '@deepkit/app';

const SegfaultHandler = require('segfault-handler');
SegfaultHandler.registerHandler('crash.log');

@entity.name('user')
export class User {
    @t.primary.autoIncrement id: number = 0;
    @t created: Date = new Date;

    constructor(
        @t.minLength(3) public username: string
    ) {
    }
}

export class SQLiteDatabase extends Database {
    constructor() {
        super(new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), [User]);
    }
}

class AddUserDto extends sliceClass(User).exclude('id', 'created') {
}

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected logger: Logger, protected database: SQLiteDatabase) {
    }
    async execute(): Promise<any> {
        this.logger.log('Loading users ...');
        const users = await this.database.query(User).find();
        console.table(users);
    }
}

async function Title(props: {title: string}) {
    return <h1>{ props.title }</h1>;
}

@injectable()
class UserList {
    constructor(
        protected props: { error?: string } = {},
        protected children: any[],
        protected database: SQLiteDatabase
    ) {
    }

    async render() {
        const users = await this.database.query(User).find();
        return <Website title="Users">
            <Title title="Users"/>

            <img src="/lara.jpeg" style="max-width: 100%"/>

            <div style="margin: 25px 0;">
                {users.map(user => <div>#{user.id} <strong>{user.username}</strong>, created {user.created}</div>)}
            </div>

            <form action="/add" method="post">
                <input type="text" name="username"/><br/>
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
    async startPage() {
        this.logger.log('Hi!');
        return <UserList/>;
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
        if (bodyValidation.hasErrors()) return <UserList error={bodyValidation.getErrorMessageForPath('username')}/>;

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
    controllers: [HelloWorldController, TestCommand],
    imports: [
        KernelModule.configure({
            debug: true, publicDir: 'public', httpLog: true,
            databases: [SQLiteDatabase], migrateOnStartup: true
        }),
    ]
}).setup((module) => {
    //enable logging JSON messages instead of formatted strings
    // module.setupProvider(Logger).setTransport([new JSONTransport]);
})
    .loadConfigFromEnvVariables('APP_')
    .run();
