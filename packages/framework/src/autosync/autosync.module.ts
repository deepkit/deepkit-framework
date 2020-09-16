import {EntityStorage} from './entity-storage';
import {deepkit} from '../decorator';

@deepkit.module({
    providers: [
        {provide: EntityStorage, scope: 'session'}
    ]
})
export class AutoSyncModule {
    //todo, onSessionEnd() call EntityStorage.destroy()
}
