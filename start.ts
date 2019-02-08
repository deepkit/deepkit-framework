import 'reflect-metadata';
import {ApplicationServer} from "./src/application-server";
import {Action, ApplicationModule, Controller} from "./src/decorators";
import {Application, Session} from "./src/application";
import {Observable} from "rxjs";
import {Collection, IdInterface} from "@kamille/core";
import {ClassType, Entity, NumberType, StringType, uuid} from "@marcj/marshal";
import {EntityStorage} from "./src/entity-storage";
import {ExchangeDatabase} from "./src/exchange-database";

@Entity('user')
class User implements IdInterface {
    @StringType()
    id: string = uuid();

    @NumberType()
    version: number = 1;

    @StringType()
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@Controller('user')
class UserController {

    constructor(private storage: EntityStorage, private database: ExchangeDatabase) {

    }

    @Action()
    name(): string {
        return "this is a name";
    }

    @Action()
    users(): Observable<User> {
        return new Observable((observer) => {
            setTimeout(() => {
                observer.next(new User('Peter1'));
            }, 1000);

            setTimeout(() => {
                observer.next(new User('Peter2'));
            }, 2000);

            setTimeout(() => {
                observer.complete();
            }, 3000);
        });
    }

    @Action()
    async userList(): Promise<Collection<User>> {
        await this.database.deleteMany(User, {});
        const peter = new User('Peter 1');

        await this.database.add(User, peter);
        await this.database.add(User, new User('Peter 2'));
        await this.database.add(User, new User('Guschdl'));
        await this.database.add(User, new User('Ingrid'));

        setTimeout(async () => {
            await this.database.add(User, new User('Peter 3'));
        }, 1000);

        setTimeout(async () => {
            await this.database.patch(User, peter.id, {name: 'Peter patched'});
        }, 3000);

        return await this.storage.find(User, {
            name: { $regex: /Peter/ }
        });
    }

    @Action()
    bla(): Observable<string> {
        return new Observable((observer) => {
            console.log('bla subscribe');

            let i = 0;
            const internal = setInterval(() => {
                if (i > 10) {
                    observer.complete();
                    clearInterval(internal);
                    return;
                }

                const next = String(i++);
                console.log('next', next);
                observer.next(next);
            }, 1000);

            return {
                unsubscribe(): void {
                    console.log('bla unsubscribe');
                    clearInterval(internal);
                }
            }
        });
    }
}


@ApplicationModule({
    controllers: [UserController],
    notifyEntities: [User],
})
class MyApp extends Application {
    async bootstrap(): Promise<any> {
        await super.bootstrap();
        console.log('bootstrapped =)');
    }

    async authenticate(token: any): Promise<Session> {
        console.log('authenticate', token);
        return super.authenticate(token);
    }
}

const app = ApplicationServer.createForModule(MyApp);

app.start();
