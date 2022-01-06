export class BenchmarkEntry {
    hz!: number;
    elapsed!: number;
    rme!: number;
    mean!: number;
}

export class BenchmarkRun {
    id?: number;
    created: Date = new Date();

    cpuName: string = '';
    cpuClock: number = 0;
    cpuCores: number = 0;
    memoryTotal: number = 0;

    os: string = '';
    commit: string = '';

    data: { [fileName: string]: { [method: string]: BenchmarkEntry } } = {};
}
