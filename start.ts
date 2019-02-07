import 'reflect-metadata';
import {ApplicationServer} from "./src/application-server";
import {Action, ApplicationModule, Controller} from "./src/decorators";
import {Application, Session} from "./src/application";
import {Observable} from "rxjs";
import {IdInterface} from "@kamille/core";
import {Entity, NumberType, StringType} from "@marcj/marshal";

@Entity('user')
class User implements IdInterface {
    @StringType()
    id!: string;

    @NumberType()
    version!: number;

    @StringType()
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@Controller('user')
class UserController {

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
    controllers: [UserController]
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
