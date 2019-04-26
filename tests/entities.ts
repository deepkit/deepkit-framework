import {
    FieldArray,
    FieldMap,
    Field,
    Entity,
    EnumField,
    Optional,
    UUIDField,
    FieldAny,
    Decorated,
    IDField,
    uuid,
} from "@marcj/marshal";
import {each, eachKey, eachPair} from "@marcj/estdlib";
import {IdInterface} from "..";


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
    install: string[] = [];

    @Field()
    dockerfile: string = '';

    @Field([String])
    install_files: string[] = [];

    @Field()
    image: string = '';

    @Field([String])
    environmentVariables: string[] = [];

    @Field([String])
    servers: string[] = [];

    @FieldArray(JobTaskCommand)
    commands: JobTaskCommand[] = [];

    @Field([String])
    args: string[] = [];

    @Field(JobResources)
    resources: JobResources = new JobResources;

    @Field(JobConfigDocker)
    docker: JobConfigDocker = new JobConfigDocker;
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

    @FieldAny({})
    parameters: { [name: string]: any } = {};

    @Field([String])
    ignore: string[] = [];

    @Field()
    priority: number = 0;

    @Field()
    import: string = '';

    @FieldMap(JobTaskConfig)
    tasks: { [name: string]: JobTaskConfig } = {};

    protected parametersArray?: { name: string, value: any }[];
}

export class JobEnvironmentPython {
    @Field()
    @Optional()
    version?: string;

    @Field()
    @Optional()
    binary?: string;

    @Field()
    @Optional()
    sdkVersion?: string;

    @Field({String})
    pipPackages: { [name: string]: string } = {};
}

export class JobEnvironment {
    @Field()
    @Optional()
    hostname?: string;

    @Field()
    @Optional()
    username?: string;

    @Field()
    @Optional()
    platform?: string;

    @Field()
    @Optional()
    release?: string;

    @Field()
    @Optional()
    arch?: string;

    @Field()
    @Optional()
    uptime?: number;

    @Field()
    @Optional()
    nodeVersion?: string;

    @Field({String})
    @Optional()
    environmentVariables?: { [name: string]: string };

    @Field(JobEnvironmentPython)
    @Optional()
    python?: JobEnvironmentPython;
}

export class JobGit {
    @Field()
    @Optional()
    author?: string;

    @Field()
    @Optional()
    authorEmail?: string;

    @Field()
    @Optional()
    branch?: string;

    @Field()
    @Optional()
    commit?: string;

    @Field()
    @Optional()
    message?: string;

    @Field()
    @Optional()
    date?: Date;

    @Field()
    @Optional()
    origin?: string;

    constructor(authorEmail: string, commit: string, message: string, date: Date) {
        this.authorEmail = authorEmail;
        this.commit = commit;
        this.message = message;
        this.date = date;
    }
}

export class JobDocker {
    @Field()
    @Optional()
    runOnVersion?: string;
}

export class JobDockerImage {
    @Field()
    @Optional()
    name?: string;

    @Field()
    @Optional()
    id?: string;

    @Field()
    @Optional()
    size?: number;

    @Field()
    @Optional()
    os?: string;

    @Field()
    @Optional()
    arch?: string;

    @Field()
    @Optional()
    created?: Date;

    @Field()
    @Optional()
    builtWithDockerVersion?: string;
}

export enum JobStatus {
    creating = 0,
    created = 50, //when all files are attached

    running = 100,

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
    checkout_files = 260, //download job files for that task instance

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
    @Optional()
    main?: boolean;

    @Field()
    @Optional()
    kpi?: boolean;

    @Field()
    kpiTrace: number = 0;

    @Field()
    maxOptimization: boolean = true;

    @FieldAny([])
    lastValue: any[] = [];

    @FieldAny()
    @Optional()
    xaxis?: object;

    @FieldAny()
    @Optional()
    yaxis?: object;

    @FieldAny()
    @Optional()
    layout?: object;
}

export class JobAssignedResourcesGpu {
    @Field()
    id: number;

    @Field()
    name: string;

    @Field()
    memory: number;

    constructor(id: number, name: string, memory: number) {
        this.id = id;
        this.name = name;
        this.memory = memory;
    }
}

export class JobAssignedResources {
    @Field()
    cpu: number = 0;

    @Field()
    memory: number = 0;

    @FieldArray(JobAssignedResourcesGpu)
    gpus: JobAssignedResourcesGpu[] = [];
}

export class JobTaskInstance {
    @Field()
    id: number;

    @EnumField(JobTaskInstanceStatus)
    status: JobTaskInstanceStatus = JobTaskInstanceStatus.pending;

    @Field(JobEnvironment)
    environment: JobEnvironment = new JobEnvironment;

    @Field(JobDocker)
    docker: JobDocker = new JobDocker;

    @Field(JobDockerImage)
    dockerImage: JobDockerImage = new JobDockerImage;

    @UUIDField()
    @Optional()
    node?: string;

    @Field()
    @Optional()
    exitCode?: number;

    @Field(JobAssignedResources)
    assignedResources: JobAssignedResources = new JobAssignedResources;

    @Field()
    @Optional()
    started?: Date;

    @Field()
    @Optional()
    ended?: Date;

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

    @EnumField(JobTaskStatus)
    status: JobTaskStatus = JobTaskStatus.pending;

    @Field()
    @Optional()
    assigned?: Date;

    @Field()
    @Optional()
    started?: Date;

    @Field()
    @Optional()
    ended?: Date;

    @Field()
    @Optional()
    exitCode?: number;

    @FieldArray(JobTaskInstance)
    public instances: JobTaskInstance[] = [];

    constructor(name: string, replicas: number) {
        this.name = name;

        for (let i = 0; i < replicas; i++) {
            this.instances[i] = new JobTaskInstance(i);
        }
    }
}

export class JobInfo {
    @Field()
    name: string;

    @FieldAny()
    value: any;

    constructor(name: string, value: any) {
        this.name = name;
        this.value = value;
    }
}

export class JobInfos {
    @Decorated()
    @FieldArray(JobInfo)
    public items: JobInfo[] = [];

    protected map: { [name: string]: JobInfo } = {};

    constructor(items: JobInfo[] = []) {
        this.items = items;
    }

    public all(): JobInfo[] {
        return this.items;
    }

    public add(name: string, value: any) {
        if (this.map[name]) {
            this.map[name].value = value;
        } else {
            this.map[name] = new JobInfo(name, value);
            this.items.push(this.map[name]);
        }
    }

    public remove(name: string) {
        if (!this.map[name]) return;

        const index = this.items.indexOf(this.map[name]);
        this.items.splice(index, 1);
        delete this.map[name];
    }
}

@Entity('job', 'jobs')
export class Job implements IdInterface {
    @IDField()
    @UUIDField()
    id: string;

    @UUIDField()
    project: string;

    @UUIDField()
    accessToken: string = uuid();

    @Field()
    number: number = 0;

    @Field()
    version: number = 1;

    @Field()
    description: string = '';

    @Field()
    connections: number = 0;

    @Field()
    alive: boolean = false;

    @Field()
    created: Date = new Date();

    @Field()
    updated: Date = new Date();

    // exitCode = 0;
    @Field()
    @Optional()
    author?: string;

    @Field(JobConfig)
    config: JobConfig = new JobConfig;

    @Field(JobGit)
    @Optional()
    git?: JobGit;

    @Field()
    @Optional()
    configFile?: string;

    @EnumField(JobStatus)
    status: JobStatus = JobStatus.creating;

    @Field()
    title: string = '';

    @Field(JobInfos)
    infos: JobInfos = new JobInfos();

    @FieldMap(JobTask)
    tasks: { [name: string]: JobTask } = {};

    @Field()
    runOnCluster: boolean = false;

    @Field()
    @Optional()
    assigned?: Date;

    @Field()
    @Optional()
    started?: Date;

    @Field()
    @Optional()
    ended?: Date;

    @Field()
    @Optional()
    ping?: Date;

    //aka epochs
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

    @FieldMap(Channel)
    channels: { [name: string]: Channel } = {};

    constructor(id: string, project: string) {
        this.id = id;
        this.project = project;
    }
}
