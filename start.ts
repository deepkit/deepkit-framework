import {Application, ApplicationServer} from "./src/application-server";
import {ApplicationModule} from "./src/decorators";


@ApplicationModule({

})
class MyApp extends Application {
    async bootstrap(): Promise<any> {
        await super.bootstrap();
        console.log('bootstrapped =)');
    }
}

const app = ApplicationServer.createForModule(MyApp);

app.start();
