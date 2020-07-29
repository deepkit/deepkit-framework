import {
    Entity,
    t
} from "../index";

export class JobConfigDocker {
    @t.array(t.string)
    env: string[] = []; //e.g. ["PATH=bla"]

    @t.array(t.string)
    binds: string[] = []; //e.g. ["/tmp:/tmp"]

    @t.array(t.string)
    links: string[] = []; //e.g. ["redis3:redis"]
}

export class JobResources {
    @t
    cpu: number = 1;

    @t
    memory: number = 1;

    @t
    gpu: number = 0;

    @t
    gpuMemory: number = 0;
}

export class JobTaskCommand {
    constructor(@t public name: string, @t public command: string) {
    }
}

export class JobTaskConfigBase {
    @t.array(t.string).optional
    install?: string[];

    @t
    dockerfile: string = '';

    @t.array(t.string)
    install_files?: string[];

    @t
    image: string = '';

    @t.array(t.string)
    environmentVariables: string[] = [];

    @t.array(t.string)
    servers: string[] = [];

    @t.array(JobTaskCommand)
    commands: JobTaskCommand[] = [];

    @t.array(t.string)
    args?: string[];

    @t
    resources: JobResources = new JobResources;

    @t
    docker: JobConfigDocker = new JobConfigDocker;
}

export class JobTaskConfig extends JobTaskConfigBase {
    /**
     * Will be set by config loading.
     */
    @t
    name: string = '';

    @t
    replicas: number = 1;

    @t.array(t.string)
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

    @t.any
    parameters: { [name: string]: any } = {};

    @t.array(t.string)
    ignore: string[] = [];

    @t
    priority: number = 0;

    @t
    import: string = '';

    @t.map(JobTaskConfig)
    tasks: { [name: string]: JobTaskConfig } = {};
}

export class JobEnvironmentPython {
    @t
    version?: string;

    @t
    binary?: string;

    @t
    sdkVersion?: string;

    @t.map(t.string)
    pipPackages: { [name: string]: string } = {};
}

export class JobEnvironment {
    @t
    hostname?: string;

    @t
    username?: string;

    @t
    platform?: string;

    @t
    release?: string;

    @t
    arch?: string;

    @t
    uptime?: number;

    @t
    nodeVersion?: string;

    @t.map(t.string)
    environmentVariables?: { [name: string]: string };

    @t
    python?: JobEnvironmentPython;
}

export class JobGit {
    @t
    author?: string;

    @t
    branch?: string;

    @t
    commit?: string;

    @t
    message?: string;

    @t
    origin?: string;
}

export class JobDocker {
    @t runOnVersion?: string;
}

export class JobDockerImage {
    @t
    name?: string;

    @t
    id?: string;

    @t
    size?: number;

    @t
    os?: string;

    @t
    arch?: string;

    @t
    created?: Date;

    @t
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
    @t.array(t.string)
    traces: string[] = [];

    @t
    main?: boolean;

    @t
    kpi?: boolean;

    @t
    kpiTrace: number = 0;

    @t
    maxOptimization: boolean = true;

    @t.array(t.any)
    lastValue: any[] = [];

    @t.any
    xaxis?: object;

    @t.any
    yaxis?: object;

    @t.any
    layout?: object;
}

export class JobAssignedResourcesGpu {
    constructor(@t public id: number, @t public memory: number) {
    }
}

export class JobAssignedResources {
    @t
    cpu: number = 0;

    @t
    memory: number = 0;

    @t.array(JobAssignedResourcesGpu)
    gpus: JobAssignedResourcesGpu[] = [];
}

export class JobTaskInstance {
    @t.enum(JobTaskInstanceStatus)
    status: JobTaskInstanceStatus = JobTaskInstanceStatus.pending;

    @t.type(JobEnvironment)
    environment: JobEnvironment = new JobEnvironment;

    @t.uuid
    server?: string;

    @t.type(JobAssignedResources)
    assignedResources: JobAssignedResources = new JobAssignedResources;

    constructor(@t public id: number) {
    }
}

export class JobTaskQueue {
    @t
    position: number = 0;

    @t
    tries: number = 0;

    @t
    result: string = '';

    @t
    added: Date = new Date();
}

export class JobTask {
    @t
    queue: JobTaskQueue = new JobTaskQueue;

    @t
    name: string;

    @t
    docker: JobDocker = new JobDocker;

    @t
    dockerImage: JobDockerImage = new JobDockerImage;

    @t.enum(JobTaskStatus)
    status: JobTaskStatus = JobTaskStatus.pending;

    @t
    assigned?: Date;

    @t
    started?: Date;

    @t
    ended?: Date;

    @t.map(JobTaskInstance)
    private instances: { [name: string]: JobTaskInstance } = {};

    constructor(name: string, replicas: number) {
        this.name = name;
    }

}


@Entity('job', 'jobs')
export class Job {
    @t.primary.uuid
    id: string;

    @t.uuid
    project: string;

    @t
    number: number = 0;

    @t
    version: number = 1;

    @t
    created: Date = new Date();

    @t
    updated: Date = new Date();

    @t
    author?: string;

    @t
    config: JobConfig = new JobConfig;

    @t.optional
    git?: JobGit;

    @t
    configFile?: string;

    @t.enum(JobStatus)
    status: JobStatus = JobStatus.creating;

    @t
    title: string = '';

    @t.map(t.any)
    infos: { [name: string]: any } = {};

    @t.map(JobTask)
    tasks: { [name: string]: JobTask } = {};

    @t
    runOnCluster: boolean = false;

    @t
    assigned?: Date;

    @t
    started?: Date;

    @t
    ended?: Date;

    @t
    ping?: Date;

    @t
    iteration: number = 0;

    @t
    iterations: number = 0;

    @t
    secondsPerIteration: number = 0;

    //aka batches
    @t
    step: number = 0;

    @t
    steps: number = 0;

    @t
    stepLabel: string = 'step';

    /**
     * ETA in seconds. Time left.
     */
    @t
    eta: number = 0;

    @t
    speed: number = 0;

    @t
    speedLabel: string = 'sample/s';

    @t.map(Channel)
    channels: { [name: string]: Channel } = {};

    constructor(id: string, project: string) {
        this.id = id;
        this.project = project;
    }
}
