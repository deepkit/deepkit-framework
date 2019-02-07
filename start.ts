import 'reflect-metadata';
import {ApplicationServer} from "./src/application-server";
import {Action, ApplicationModule, Controller} from "./src/decorators";
import {Application, Session} from "./src/application";

@Controller('user')
class UserController {

    @Action()
    name(): string {
        return "this is a name";
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
