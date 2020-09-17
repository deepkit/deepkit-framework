import 'reflect-metadata';
import {Application, http, template} from '@deepkit/framework';
import {entity, t} from '@deepkit/type';
import {Website} from './views/website';
import {OrmModule} from '@deepkit/orm-module';
import {Database} from '@deepkit/orm';
import {SQLiteDatabaseAdapter} from '@deepkit/sql';

@entity.name('HelloBody')
class HelloBody {
    @t name: string = '';
}

class HelloWorldController {
    @http.GET('/')
    startPage() {
        return <Website title="Startpage">
            <p>Hello there!</p>
        </Website>;
    }
}

const user = t.schema({
    id: t.number.primary.autoIncrement,
    username: t.string,
    created: t.date,
}, {name: 'user'});

const SQLiteDatabase = Database.createClass('sqlite', new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), [user]);

Application.root({
    providers: [
        SQLiteDatabase
    ],
    controllers: [HelloWorldController],
    imports: [
        OrmModule.forDatabases(SQLiteDatabase)
    ]
}).run();
