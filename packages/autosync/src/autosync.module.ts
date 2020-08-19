import {hornet} from "@super-hornet/framework-server-common";
import {EntityStorage} from "./entity-storage";

@hornet.module({
    providers: [
        {provide: EntityStorage, scope: 'session'}
    ]
})
export class AutoSyncModule {
    //todo, onSessionEnd() call EntityStorage.destroy()
}
