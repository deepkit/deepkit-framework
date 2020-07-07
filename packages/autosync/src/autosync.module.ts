import {Module} from "@super-hornet/framework-server-common";
import {EntityStorage} from "./entity-storage";

@Module({
    providers: [
        {provide: EntityStorage, scope: 'session'}
    ]
})
export class AutoSyncModule {
    //todo, onSessionEnd() call EntityStorage.destroy()
}
