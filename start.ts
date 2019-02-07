import 'reflect-metadata';
import {ApplicationServer} from "./src/application-server";
import {Action, ApplicationModule, Controller} from "./src/decorators";
import {Application, Session} from "./src/application";
import {Observable} from "rxjs";

@Controller('user')
class UserController {

    @Action()
    name(): string {
        return "this is a name";
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
