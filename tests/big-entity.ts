import {
    Entity,
    f
} from "../index";

export class JobConfigDocker {
    @f.array(String)
    env: string[] = []; //e.g. ["PATH=bla"]

    @f.array(String)
    binds: string[] = []; //e.g. ["/tmp:/tmp"]

    @f.array(String)
    links: string[] = []; //e.g. ["redis3:redis"]
}

export class JobResources {
    @f
    cpu: number = 1;

    @f
    memory: number = 1;

    @f
    gpu: number = 0;

    @f
    gpuMemory: number = 0;
}

export class JobTaskCommand {
    constructor(@f public name: string, @f public command: string) {
    }
}

export class JobTaskConfigBase {
    @f.array(String)
    install?: string[];

    @f
    dockerfile: string = '';

    @f.array(String)
    install_files?: string[];

    @f
    image: string = '';

    @f.array(String)
    environmentVariables: string[] = [];

    @f.array(String)
    servers: string[] = [];

    @f.array(JobTaskCommand)
    commands: JobTaskCommand[] = [];

    @f.array(String)
    args?: string[];

    @f
    resources: JobResources = new JobResources;

    @f
    docker: JobConfigDocker = new JobConfigDocker;
}

export class JobTaskConfig extends JobTaskConfigBase {
    /**
     * Will be set by config loading.
     */
    @f
    name: string = '';

    @f
    replicas: number = 1;

    @f.array(String)
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

    @f.any()
    parameters: { [name: string]: any } = {};

    @f.array(String)
    ignore: string[] = [];

    @f
    priority: number = 0;

    @f
    import: string = '';

    @f.map(JobTaskConfig)
    tasks: { [name: string]: JobTaskConfig } = {};
}

export class JobEnvironmentPython {
    @f
    version?: string;

    @f
    binary?: string;

    @f
    sdkVersion?: string;

    @f.map(String)
    pipPackages: { [name: string]: string } = {};
}

export class JobEnvironment {
    @f
    hostname?: string;

    @f
    username?: string;

    @f
    platform?: string;

    @f
    release?: string;

    @f
    arch?: string;

    @f
    uptime?: number;

    @f
    nodeVersion?: string;

    @f.map(String)
    environmentVariables?: { [name: string]: string };

    @f
    python?: JobEnvironmentPython;
}

export class JobGit {
    @f
    author?: string;

    @f
    branch?: string;

    @f
    commit?: string;

    @f
    message?: string;

    @f
    origin?: string;
}

export class JobDocker {
    @f runOnVersion?: string;
}

export class JobDockerImage {
    @f
    name?: string;

    @f
    id?: string;

    @f
    size?: number;

    @f
    os?: string;

    @f
    arch?: string;

    @f
    created?: Date;

    @f
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
    @f.array(String)
    traces: string[] = [];

    @f
    main?: boolean;

    @f
    kpi?: boolean;

    @f
    kpiTrace: number = 0;

    @f
    maxOptimization: boolean = true;

    @f.any().asArray()
    lastValue: any[] = [];

    @f.any()
    xaxis?: object;

    @f.any()
    yaxis?: object;

    @f.any()
    layout?: object;
}

export class JobAssignedResourcesGpu {
    constructor(@f public id: number, @f public memory: number) {
    }
}

export class JobAssignedResources {
    @f
    cpu: number = 0;

    @f
    memory: number = 0;

    @f.array(JobAssignedResourcesGpu)
    gpus: JobAssignedResourcesGpu[] = [];
}

export class JobTaskInstance {
    @f.enum(JobTaskInstanceStatus)
    status: JobTaskInstanceStatus = JobTaskInstanceStatus.pending;

    @f.type(JobEnvironment)
    environment: JobEnvironment = new JobEnvironment;

    @f.uuid()
    server?: string;

    @f.type(JobAssignedResources)
    assignedResources: JobAssignedResources = new JobAssignedResources;

    constructor(@f public id: number) {
    }
}

export class JobTaskQueue {
    @f
    position: number = 0;

    @f
    tries: number = 0;

    @f
    result: string = '';

    @f
    added: Date = new Date();
}

export class JobTask {
    @f
    queue: JobTaskQueue = new JobTaskQueue;

    @f
    name: string;

    @f
    docker: JobDocker = new JobDocker;

    @f
    dockerImage: JobDockerImage = new JobDockerImage;

    @f.enum(JobTaskStatus)
    status: JobTaskStatus = JobTaskStatus.pending;

    @f
    assigned?: Date;

    @f
    started?: Date;

    @f
    ended?: Date;

    @f.map(JobTaskInstance)
    private instances: { [name: string]: JobTaskInstance } = {};

    constructor(name: string, replicas: number) {
        this.name = name;
    }

}


@Entity('job', 'jobs')
export class Job {
    @f.primary().uuid()
    id: string;

    @f.uuid()
    project: string;

    @f
    number: number = 0;

    @f
    version: number = 1;

    @f
    created: Date = new Date();

    @f
    updated: Date = new Date();

    @f
    author?: string;

    @f
    config: JobConfig = new JobConfig;

    @f.optional()
    git?: JobGit;

    @f
    configFile?: string;

    @f.enum(JobStatus)
    status: JobStatus = JobStatus.creating;

    @f
    title: string = '';

    @f.any().asMap()
    infos: { [name: string]: any } = {};

    @f.map(JobTask)
    tasks: { [name: string]: JobTask } = {};

    @f
    runOnCluster: boolean = false;

    @f
    assigned?: Date;

    @f
    started?: Date;

    @f
    ended?: Date;

    @f
    ping?: Date;

    @f
    iteration: number = 0;

    @f
    iterations: number = 0;

    @f
    secondsPerIteration: number = 0;

    //aka batches
    @f
    step: number = 0;

    @f
    steps: number = 0;

    @f
    stepLabel: string = 'step';

    /**
     * ETA in seconds. Time left.
     */
    @f
    eta: number = 0;

    @f
    speed: number = 0;

    @f
    speedLabel: string = 'sample/s';

    @f.map(Channel)
    channels: { [name: string]: Channel } = {};

    constructor(id: string, project: string) {
        this.id = id;
        this.project = project;
    }
}
