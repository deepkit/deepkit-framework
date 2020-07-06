import {Module} from "./decorators";
import {ProcessLocker} from "./process-locker";
import {FS} from "./fs";
import {InternalClient} from "./internal-client";
import {Configuration} from "./configuration";

@Module({
    providers: [
        ProcessLocker,
        FS,
        InternalClient,
        Configuration,
    ]
})
export class HornetBaseModule {
}
