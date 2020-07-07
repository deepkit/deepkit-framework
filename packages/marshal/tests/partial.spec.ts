import 'jest';
import 'jest-extended';
import {Entity, f, partialClassToPlain, uuid} from "..";
import {JitPropertyConverter} from "../src/jit";
import {Channel, Job} from "./big-entity";

@Entity('jobModelGraphSnapshotLayer')
class JobModelGraphSnapshotLayer {
    @f.optional()
    saved?: Date;

    @f.optional()
    outputFilePath?: string;

    @f.optional()
    dataFilePath?: string;
}

@Entity('jobModelGraphSnapshot')
class JobModelGraphSnapshot {
    @f.primary().uuid()
    id: string = uuid();

    @f version: number = 0;

    @f epoch: number = 0;

    @f step: number = 0;

    @f created: Date = new Date;

    @f graphPath: string = '';

    @f.index()
    live: boolean = false;

    @f.map(JobModelGraphSnapshotLayer)
    layerInfo: { [layerName: string]: JobModelGraphSnapshotLayer } = {};

    constructor(@f.uuid().index().asName('job') public job: string) {
    }
}

test('break JitPropertyConverter', () => {
    {
        const converter = new JitPropertyConverter('class', 'plain', Job);
        const c = new Channel();
        c.lastValue = [12, 44];
        c.main = true;
        const v = converter.convert('channels.test123', c);
        expect(v).toEqual({
            kpiTrace: 0,
            lastValue: [12, 44],
            main: true,
            maxOptimization: true,
            traces: [],
        });
    }

    {
        const sl = new JobModelGraphSnapshotLayer();
        sl.saved = new Date;
        sl.outputFilePath = './my/output.path';

        const converter = new JitPropertyConverter('class', 'plain', JobModelGraphSnapshot);
        const v = converter.convert('layerInfo.bla', sl);
        //this breaks when we cache only getCacheKey() for virtual properties schemas
        expect(v).toEqual({
            saved: sl.saved.toJSON(),
            outputFilePath: './my/output.path',
        })
    }
});
