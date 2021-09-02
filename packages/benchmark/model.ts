import { t } from '@deepkit/type';

export class BenchmarkEntry {
    @t hz!: number;
    @t elapsed!: number;
    @t rme!: number;
    @t mean!: number;
}

export class BenchmarkRun {
    @t.primary.autoIncrement id?: number;
    @t created: Date = new Date();

    @t cpuName: string = '';
    @t cpuClock: number = 0;
    @t cpuCores: number = 0;
    @t memoryTotal: number = 0;

    @t os: string = '';
    @t commit: string = '';

    @t.map(t.map(BenchmarkEntry))
    data: { [fileName: string]: { [method: string]: BenchmarkEntry } } = {};
}
