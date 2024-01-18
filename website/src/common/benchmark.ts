import { ControllerSymbol } from '@deepkit/rpc';
import { AutoIncrement, entity, Index, PrimaryKey } from '@deepkit/type';

@entity.name('benchmarkEntry')
export class BenchmarkEntry {
    hz!: number;
    elapsed!: number;
    rme!: number;
    mean!: number;
}

@entity.name('benchmarkRun')
export class BenchmarkRun {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date();

    cpuName: string = '';
    cpuClock: number = 0;
    cpuCores: number = 0;
    memoryTotal: number = 0;

    os: string = '';
    commit: string & Index = '';

    data: { [fileName: string]: { [method: string]: BenchmarkEntry } } = {};
}

export const BenchmarkControllerInterface = ControllerSymbol<BenchmarkControllerInterface>('benchmark', [BenchmarkRun, BenchmarkEntry]);

export interface BenchmarkControllerInterface {
    getLastBenchmarkRuns(): Promise<BenchmarkRun[]>;
}
