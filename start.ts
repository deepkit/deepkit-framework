import {ApplicationServer} from "./src/application-server";
import {ApplicationModule} from "./src/decorators";
import {Application, Session} from "./src/application";


@ApplicationModule({

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
