import 'jest';
import {Application} from "../src/app";
import {StringType} from "@marcj/marshal";
import {Observable} from "rxjs";

test('test', () => {
    function action() {
        return (target: object, property: string) => {
        }
    }

    class Query {
        @StringType()
        q!: string;
    }

    class TestController {
        @action()
        public getItems(query: Query): string[] {
            return [query.q, 'dd'];
        }

        @action()
        public findItems(query: Query): Observable<string> {
            return new Observable((observer) => {
                observer.next(query.q);
                observer.next('dd');
            });
        }
    }

    interface TestController {
        getItems(query: Query): string[];
    }

    const app = new Application();
    app.registerController('test', TestController);
    app.start();

    const client = new Client();
    const test = client.api<TestController>('test');

    test.getItems();
});
