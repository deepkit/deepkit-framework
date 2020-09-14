import 'reflect-metadata';
import {Application, http, HttpBadRequestError, template} from '@deepkit/framework';
import {entity, t} from '@deepkit/type';
import {Website} from './views/website';

@entity.name('HelloBody')
class HelloBody {
    @t name: string = '';
}

class Database {
    async getData() {
        return 'async data arrived';
    }
}

class HelloWorldController {
    @http.GET('/')
    startPage() {
        return <Website title="Startpage">
            <p>Hello there!</p>
        </Website>;
    }
}

Application.root({
    providers: [Database],
    controllers: [HelloWorldController],
}).run();
