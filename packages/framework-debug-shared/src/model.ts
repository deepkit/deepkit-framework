import { entity, t } from '@deepkit/type';

@entity.name('debugRequest')
export class DebugRequest {
    @t.primary.autoIncrement id: number = 0;
    @t version: number = 0;
    @t created: Date = new Date;
    @t.optional statusCode?: number;
    @t logs: number = 0;

    @t.map(t.number) times: { [name: string]: number } = {};

    constructor(
        @t public method: string,

        @t public url: string,
        @t public clientIp: string,
    ) {
    }
}
