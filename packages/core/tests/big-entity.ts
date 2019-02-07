import {
    AnyType,
    ArrayType,
    BooleanType,
    Class,
    ClassArray,
    ClassMap,
    DateType,
    Entity,
    EnumType,
    ID,
    MapType,
    NumberType,
    Optional,
    StringType,
    UUIDType,
} from '../';

export class JobConfigDocker {
    @StringType()
    @ArrayType()
    env: string[] = []; //e.g. ["PATH=bla"]

    @StringType()
    @ArrayType()
    binds: string[] = []; //e.g. ["/tmp:/tmp"]

    @StringType()
    @ArrayType()
    links: string[] = []; //e.g. ["redis3:redis"]
}

export class JobResources {
    @NumberType()
    cpu: number = 1;

    @NumberType()
    memory: number = 1;

    @NumberType()
    gpu: number = 0;

    @NumberType()
    gpuMemory: number = 0;
}

export class JobTaskCommand {
    @StringType()
    name: string = '';

    @StringType()
    command: string = '';

    constructor(name: string, command: string) {
        this.name = name;
        this.command = command;
    }
}

export class JobTaskConfigBase {
    @StringType()
    @ArrayType()
    install: string[] | null = null;

    @StringType()
    dockerfile: string = '';

    @StringType()
    @ArrayType()
    install_files: string[] | null = null;

    @StringType()
    image: string = '';

    @StringType()
    @ArrayType()
    environmentVariables: string[] = [];

    @StringType()
    @ArrayType()
    servers: string[] = [];

    @ClassArray(JobTaskCommand)
    commands: JobTaskCommand[] = [];

    @StringType()
    @ArrayType()
    args: null | string[] = null;

    @Class(JobResources)
    resources: JobResources = new JobResources();

    @Class(JobConfigDocker)
    docker: JobConfigDocker = new JobConfigDocker();

    public isDockerImage(): boolean {
        return !!this.image;
    }

    public hasCommand() {
        return this.commands.length > 0;
    }
}

export class JobTaskConfig extends JobTaskConfigBase {
    /**
     * Will be set by config loading.
     */
    @StringType()
    name: string = '';

    @NumberType()
    replicas: number = 1;

    @StringType()
    @ArrayType()
    depends_on: string[] = [];
}

export class JobConfig extends JobTaskConfigBase {
    public static readonly inheritTaskProperties: string[] = [
        'install',
        'dockerfile',
        'install_files',
        'image',
        'environmentVariables',
        'servers',
        'resources',
        'commands',
        'args',
        'docker',
    ];

    @AnyType()
    parameters: { [name: string]: any } = {};

    @StringType()
    @ArrayType()
    ignore: string[] = [];

    @NumberType()
    priority: number = 0;

    @StringType()
    import: string = '';

    @ClassMap(JobTaskConfig)
    tasks: { [name: string]: JobTaskConfig } = {};
}

export class JobEnvironmentPython {
    @StringType()
    version?: string;

    @StringType()
    binary?: string;

    @StringType()
    sdkVersion?: string;

    @StringType()
    @MapType()
    pipPackages: { [name: string]: string } = {};
}

export class JobEnvironment {
    @StringType()
    hostname?: string;

    @StringType()
    username?: string;

    @StringType()
    platform?: string;

    @StringType()
    release?: string;

    @StringType()
    arch?: string;

    @NumberType()
    uptime?: number;

    @StringType()
    nodeVersion?: string;

    @StringType()
    @MapType()
    environmentVariables?: { [name: string]: string };

    @Class(JobEnvironmentPython)
    python?: JobEnvironmentPython;
}

export class JobGit {
    @StringType()
    author?: string;

    @StringType()
    branch?: string;

    @StringType()
    commit?: string;

    @StringType()
    message?: string;

    @StringType()
    origin?: string;
}

export class JobDocker {
    runOnVersion?: string;
}

export class JobDockerImage {
    @StringType()
    name?: string;

    @StringType()
    id?: string;

    @NumberType()
    size?: number;

    @StringType()
    os?: string;

    @StringType()
    arch?: string;

    @DateType()
    created?: Date;

    @StringType()
    builtWithDockerVersion?: string;
}

export enum JobStatus {
    creating = 0,
    created = 50, //when all files are attached

    started = 100,

    done = 150, //when all tasks are done
    aborted = 200, //when at least one task aborted

    failed = 250, //when at least one task failed
    crashed = 300, //when at least one task crashed
}

export enum JobTaskStatus {
    pending = 0,

    queued = 100, //when the job got a queue position assigned and queue results
    assigned = 150, //when a server or multiple servers are assigned and at least one replica is about to start

    started = 300,

    //beginning with that ended
    done = 500,
    aborted = 550,
    failed = 600,
    crashed = 650,
}

export enum JobTaskInstanceStatus {
    pending = 0,

    booting = 200, //is starting the job's task
    docker_pull = 220, //joining docker's network
    docker_build = 230, //joining docker's network
    joining_network = 250, //joining docker's network

    started = 300,

    //beginning with that ended
    done = 500,
    aborted = 550,
    failed = 600,
    crashed = 650,
}

export class Channel {
    @StringType()
    @ArrayType()
    traces: string[] = [];

    @BooleanType()
    main?: boolean;

    @BooleanType()
    kpi?: boolean;

    @NumberType()
    kpiTrace: number = 0;

    @BooleanType()
    maxOptimization: boolean = true;

    @AnyType()
    @ArrayType()
    lastValue: any[] = [];

    @AnyType()
    xaxis?: object;

    @AnyType()
    yaxis?: object;

    @AnyType()
    layout?: object;
}

export class JobAssignedResourcesGpu {
    @NumberType()
    id: number;

    @NumberType()
    memory: number;

    constructor(id: number, memory: number) {
        this.id = id;
        this.memory = memory;
    }
}

export class JobAssignedResources {
    @NumberType()
    cpu: number = 0;

    @NumberType()
    memory: number = 0;

    @ClassArray(JobAssignedResourcesGpu)
    gpus: JobAssignedResourcesGpu[] = [];

    public getMinGpuMemory(): number {
        let minGpuMemory = 0;

        for (const gpu of this.gpus) {
            if (gpu.memory < minGpuMemory) minGpuMemory = gpu.memory;
        }

        return minGpuMemory;
    }

    public getMaxGpuMemory(): number {
        let maxGpuMemory = 0;

        for (const gpu of this.gpus) {
            if (gpu.memory > maxGpuMemory) maxGpuMemory = gpu.memory;
        }

        return maxGpuMemory;
    }

    public getGpuMemoryRange(): string {
        const min = this.getMinGpuMemory();
        const max = this.getMaxGpuMemory();

        if (min === max) return `${min}`;

        return `${min}-${max}`;
    }
}

export class JobTaskInstance {
    @NumberType()
    id: number;

    @EnumType(JobTaskInstanceStatus)
    status: JobTaskInstanceStatus = JobTaskInstanceStatus.pending;

    @Class(JobEnvironment)
    environment: JobEnvironment = new JobEnvironment();

    @UUIDType()
    server?: string;

    @Class(JobAssignedResources)
    assignedResources: JobAssignedResources = new JobAssignedResources();

    constructor(id: number) {
        this.id = id;
    }

    public isStarted() {
        return this.status >= JobTaskInstanceStatus.booting;
    }

    public isRunning() {
        return this.isStarted() && !this.isEnded();
    }

    public isEnded() {
        return this.status >= JobTaskInstanceStatus.done;
    }
}

export class JobTaskQueue {
    @NumberType()
    position: number = 0;

    @NumberType()
    tries: number = 0;

    @StringType()
    result: string = '';

    @DateType()
    added: Date = new Date();
}

export class JobTask {
    @Class(JobTaskQueue)
    queue: JobTaskQueue = new JobTaskQueue();

    @StringType()
    name: string;

    @Class(JobDocker)
    docker: JobDocker = new JobDocker();

    @Class(JobDockerImage)
    dockerImage: JobDockerImage = new JobDockerImage();

    // exitCodes: { [key: string]: number } = {};

    // @UUIDType()
    // server: string | null = null;

    @EnumType(JobTaskStatus)
    status: JobTaskStatus = JobTaskStatus.pending;

    // @Class(JobAssignedResources)
    // assignedResources: JobAssignedResources = new JobAssignedResources;

    @DateType()
    assigned: Date | null = null;

    @DateType()
    started: Date | null = null;

    @DateType()
    ended: Date | null = null;

    @ClassMap(JobTaskInstance)
    private instances: { [name: string]: JobTaskInstance } = {};

    constructor(name: string, replicas: number) {
        this.name = name;

        for (let i = 1; i <= replicas; i++) {
            this.instances[this.name + '_' + i] = new JobTaskInstance(i);
        }
    }
}

@Entity('job', 'jobs')
export class Job {
    @ID()
    @UUIDType()
    id: string;

    @UUIDType()
    project: string;

    @NumberType()
    number: number = 0;

    @NumberType()
    version: number = 1;

    //obsolete
    alive: boolean = false;

    @DateType()
    created: Date = new Date();

    @DateType()
    updated: Date = new Date();

    // exitCode = 0;
    @StringType()
    author?: string;

    @Class(JobConfig)
    config: JobConfig = new JobConfig();

    @Class(JobGit)
    @Optional()
    git?: JobGit;

    @StringType()
    configFile?: string;

    @EnumType(JobStatus)
    status: JobStatus = JobStatus.creating;

    @StringType()
    title: string = '';

    @ClassMap(JobTask)
    tasks: { [name: string]: JobTask } = {};

    @BooleanType()
    runOnCluster: boolean = false;

    @DateType()
    assigned: Date | null = null;

    @DateType()
    started: Date | null = null;

    @DateType()
    ended: Date | null = null;

    @DateType()
    ping: Date | null = null;

    //aka epochs
    @NumberType()
    iteration: number = 0;

    @NumberType()
    iterations: number = 0;

    @NumberType()
    secondsPerIteration: number = 0;

    //aka batches
    @NumberType()
    step: number = 0;

    @NumberType()
    steps: number = 0;

    @StringType()
    stepLabel: string = 'step';

    /**
     * ETA in seconds. Time left.
     */
    @NumberType()
    eta: number = 0;

    @NumberType()
    speed: number = 0;

    @StringType()
    speedLabel: string = 'sample/s';

    @ClassMap(Channel)
    channels: { [name: string]: Channel } = {};

    constructor(id: string, project: string) {
        this.id = id;
        this.project = project;
    }
}
