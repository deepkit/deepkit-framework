import {
    Entity,
    EnumType,
    Field,
    FieldAny,
    IDField,
    Optional,
    UUIDField
} from "../";

export class JobConfigDocker {
    @Field([String])
    env: string[] = []; //e.g. ["PATH=bla"]

    @Field([String])
    binds: string[] = []; //e.g. ["/tmp:/tmp"]

    @Field([String])
    links: string[] = []; //e.g. ["redis3:redis"]
}

export class JobResources {
    @Field()
    cpu: number = 1;

    @Field()
    memory: number = 1;

    @Field()
    gpu: number = 0;

    @Field()
    gpuMemory: number = 0;
}

export class JobTaskCommand {
    @Field()
    name: string = '';

    @Field()
    command: string = '';

    constructor(name: string, command: string) {
        this.name = name;
        this.command = command;
    }
}

export class JobTaskConfigBase {
    @Field([String])
    install?: string[];

    @Field()
    dockerfile: string = '';

    @Field([String])
    install_files?: string[];

    @Field()
    image: string = '';

    @Field([String])
    environmentVariables: string[] = [];

    @Field([String])
    servers: string[] = [];

    @Field([JobTaskCommand])
    commands: JobTaskCommand[] = [];

    @Field([String])
    args?: string[];

    @Field(JobResources)
    resources: JobResources = new JobResources;

    @Field(JobConfigDocker)
    docker: JobConfigDocker = new JobConfigDocker;

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
    @Field()
    name: string = '';

    @Field()
    replicas: number = 1;

    @Field([String])
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
        'docker'
    ];

    @FieldAny()
    parameters: { [name: string]: any } = {};

    @Field([String])
    ignore: string[] = [];

    @Field()
    priority: number = 0;

    @Field()
    import: string = '';

    @Field({JobTaskConfig})
    tasks: { [name: string]: JobTaskConfig } = {};
}

export class JobEnvironmentPython {
    @Field()
    version?: string;

    @Field()
    binary?: string;

    @Field()
    sdkVersion?: string;

    @Field({String})
    pipPackages: { [name: string]: string } = {};
}

export class JobEnvironment {
    @Field()
    hostname?: string;

    @Field()
    username?: string;

    @Field()
    platform?: string;

    @Field()
    release?: string;

    @Field()
    arch?: string;

    @Field()
    uptime?: number;

    @Field()
    nodeVersion?: string;

    @Field({String})
    environmentVariables?: { [name: string]: string };

    @Field(JobEnvironmentPython)
    python?: JobEnvironmentPython;
}

export class JobGit {
    @Field()
    author?: string;

    @Field()
    branch?: string;

    @Field()
    commit?: string;

    @Field()
    message?: string;

    @Field()
    origin?: string;
}

export class JobDocker {
    runOnVersion?: string;
}

export class JobDockerImage {
    @Field()
    name?: string;

    @Field()
    id?: string;

    @Field()
    size?: number;

    @Field()
    os?: string;

    @Field()
    arch?: string;

    @Field()
    created?: Date;

    @Field()
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
    @Field([String])
    traces: string[] = [];

    @Field()
    main?: boolean;

    @Field()
    kpi?: boolean;

    @Field()
    kpiTrace: number = 0;

    @Field()
    maxOptimization: boolean = true;

    @FieldAny([])
    lastValue: any[] = [];

    @FieldAny()
    xaxis?: object;

    @FieldAny()
    yaxis?: object;

    @FieldAny()
    layout?: object;
}

export class JobAssignedResourcesGpu {
    @Field()
    id: number;

    @Field()
    memory: number;

    constructor(id: number, memory: number) {
        this.id = id;
        this.memory = memory;
    }
}

export class JobAssignedResources {
    @Field()
    cpu: number = 0;

    @Field()
    memory: number = 0;

    @Field([JobAssignedResourcesGpu])
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
    @Field()
    id: number;

    @EnumType(JobTaskInstanceStatus)
    status: JobTaskInstanceStatus = JobTaskInstanceStatus.pending;

    @Field(JobEnvironment)
    environment: JobEnvironment = new JobEnvironment;

    @UUIDField()
    server?: string;

    @Field(JobAssignedResources)
    assignedResources: JobAssignedResources = new JobAssignedResources;

    constructor(id: number) {
        this.id = id;
    }
}

export class JobTaskQueue {
    @Field()
    position: number = 0;

    @Field()
    tries: number = 0;

    @Field()
    result: string = '';

    @Field()
    added: Date = new Date();
}

export class JobTask {
    @Field(JobTaskQueue)
    queue: JobTaskQueue = new JobTaskQueue;

    @Field()
    name: string;

    @Field(JobDocker)
    docker: JobDocker = new JobDocker;

    @Field(JobDockerImage)
    dockerImage: JobDockerImage = new JobDockerImage;

    @EnumType(JobTaskStatus)
    status: JobTaskStatus = JobTaskStatus.pending;

    @Field()
    assigned?: Date;

    @Field()
    started?: Date;

    @Field()
    ended?: Date;

    @Field({JobTaskInstance})
    private instances: { [name: string]: JobTaskInstance } = {};

    constructor(name: string, replicas: number) {
        this.name = name;
    }

}


@Entity('job', 'jobs')
export class Job {
    @IDField()
    @UUIDField()
    id: string;

    @UUIDField()
    project: string;

    @Field()
    number: number = 0;

    @Field()
    version: number = 1;

    @Field()
    created: Date = new Date();

    @Field()
    updated: Date = new Date();

    @Field()
    author?: string;

    @Field(JobConfig)
    config: JobConfig = new JobConfig;

    @Field(JobGit)
    @Optional()
    git?: JobGit;

    @Field()
    configFile?: string;

    @EnumType(JobStatus)
    status: JobStatus = JobStatus.creating;

    @Field()
    title: string = '';

    @Field({JobTask})
    tasks: { [name: string]: JobTask } = {};

    @Field()
    runOnCluster: boolean = false;

    @Field()
    assigned?: Date;

    @Field()
    started?: Date;

    @Field()
    ended?: Date;

    @Field()
    ping?: Date;

    @Field()
    iteration: number = 0;

    @Field()
    iterations: number = 0;

    @Field()
    secondsPerIteration: number = 0;

    //aka batches
    @Field()
    step: number = 0;

    @Field()
    steps: number = 0;

    @Field()
    stepLabel: string = 'step';

    /**
     * ETA in seconds. Time left.
     */
    @Field()
    eta: number = 0;

    @Field()
    speed: number = 0;

    @Field()
    speedLabel: string = 'sample/s';

    @Field({Channel})
    channels: { [name: string]: Channel } = {};

    constructor(id: string, project: string) {
        this.id = id;
        this.project = project;
    }
}
