import {EntityStorage} from './entity-storage';
import {hornet} from '../decorator';

@hornet.module({
    providers: [
        {provide: EntityStorage, scope: 'session'}
    ]
})
export class AutoSyncModule {
    //todo, onSessionEnd() call EntityStorage.destroy()
}
