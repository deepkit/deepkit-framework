import 'reflect-metadata';
import {Application, http, HttpBadRequestError, template} from '@super-hornet/framework';
import {entity, t} from '@super-hornet/marshal';
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
    @http.GET('/favicon.ico')
    nix() {
    }

    @http.GET('/simple')
    simple() {
        return <div>
            Test <strong>Yes</strong>
            <img src="lara.jpeg"/>
        </div>;
    }

    @http.GET('/')
    startPage() {
        return 'asd';
    }

    @http.GET('/product')
    async product() {
        async function loadUsers() {
            return ['Peter', 'Marc', 'Philipp'];
        }

        return <Website title="Product">
            <div>My Peter</div>
            <div>Mowla {await loadUsers()}</div>
        </Website>;
    }

    @http.GET('/about')
    about() {
        return <Website title="About">LOL</Website>;
    }
}

Application.root({
    providers: [Database],
    controllers: [HelloWorldController],
}).run();
