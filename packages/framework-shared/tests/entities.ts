import {
    Entity, t,
    uuid,
} from "@deepkit/type";
import {each, eachPair} from "@deepkit/core";
import {IdInterface} from "../index";

@Entity('JobAssignedResourcesGpu')
export class JobAssignedResourcesGpu {
    constructor(
        @t.name('uuid') public uuid: string,
        @t.name('name') public name: string,
        @t.name('memory') public memory: number,
    ) {
    }
}


@Entity('JobAssignedResources')
export class JobAssignedResources {
    @t
    cpu: number = 0;

    @t
    memory: number = 0;

    @t.array(JobAssignedResourcesGpu)
    gpus: JobAssignedResourcesGpu[] = [];

    public getMinGpuMemory(): number {
        let minGpuMemory = 0;

        for (const gpu of this.gpus) {
            if (!minGpuMemory || gpu.memory < minGpuMemory) minGpuMemory = gpu.memory;
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

    public getGpuUUIDs(): string[] {
        return this.gpus.map(v => v.uuid);
    }

    public getGpuMemoryRange(): string {
        const min = this.getMinGpuMemory();
        const max = this.getMaxGpuMemory();

        if (min === max) return `${min}`;

        return `${min}-${max}`;
    }
}

export class JobConfigDocker {
    @t.array(String)
    env: string[] = []; //e.g. ["PATH=bla"]

    @t.array(String)
    binds: string[] = []; //e.g. ["/tmp:/tmp"]

    @t.array(String)
    links: string[] = []; //e.g. ["redis3:redis"]
}

export class JobResources {
    @t
    minCpu: number = 0;

    @t
    maxCpu: number = 0;

    @t
    cpu: number = 0;

    @t
    allMemory: boolean = true;

    @t
    minMemory: number = 0;

    @t
    maxMemory: number = 0;

    @t
    memory: number = 0;


    @t
    minGpu: number = 0;

    @t
    maxGpu: number = 0;

    @t
    gpu: number = 0;

    /**
     * Value in GB. Defines minimum gpu memory that is necessary.
     */
    @t
    minGpuMemory: number = 0;

    static fromPartial(partial: Partial<JobResources>): JobResources {
        const resources = new JobResources;
        for (const [i, v] of eachPair(partial)) {
            (resources as any)[i] = v;
        }
        return resources;
    }

    public normalizeValues() {
        this.cpu = Math.max(this.cpu, 0);
        this.maxCpu = Math.max(this.maxCpu, 0);
        this.minCpu = Math.max(this.minCpu, 0);

        this.memory = Math.max(this.memory, 0);
        this.maxMemory = Math.max(this.maxMemory, 0);
        this.minMemory = Math.max(this.minMemory, 0);

        this.gpu = Math.max(this.gpu, 0);
        this.maxGpu = Math.max(this.maxGpu, 0);
        this.minGpu = Math.max(this.minGpu, 0);
        this.minGpuMemory = Math.max(this.minGpuMemory, 0);
    }

    public getMinCpu(): number {
        return Math.max(this.minCpu || this.cpu, 1);
    }

    public getMaxCpu(): number {
        return Math.max(this.maxCpu || this.cpu, 1);
    }

    public getMinMemory(): number {
        return Math.max(this.minMemory || this.memory, 1);
    }

    public getMaxMemory(): number {
        return Math.max(this.maxMemory || this.memory, 1);
    }

    public getMinGpu(): number {
        return Math.max(this.minGpu || this.gpu, 0);
    }

    public getMaxGpu(): number {
        return Math.max(this.maxGpu || this.gpu, 0);
    }
}

export class JobTaskCommand {
    constructor(
        @t.name('name')
        public name: string = '',
        @t.name('command')
        public command: string = '',
    ) {
    }
}

export class JobTaskConfigBase {
    @t
    label: string = '';

    @t.array(String)
    install: string[] = [];

    @t
    dockerfile: string = '';

    @t.array(String)
    install_files: string[] = [];

    @t
    image: string = '';

    @t.array(String)
    output: string[] = [];

    @t.array(String)
    environmentVariables: string[] = [];

    @t.array(String)
    nodeIds: string[] = [];

    @t.array(String)
    nodes: string[] = [];

    @t.array(String)
    clusters: string[] = [];

    @t.array(JobTaskCommand)
    commands: JobTaskCommand[] = [];

    @t.array(String)
    args: string[] = [];

    @t.type(JobResources)
    resources: JobResources = new JobResources;

    @t.type(JobConfigDocker)
    docker: JobConfigDocker = new JobConfigDocker;

    public isDockerImage(): boolean {
        return !!this.image;
    }

    public hasCommand() {
        return this.commands.length > 0;
    }

    get installString(): string {
        return this.install.join('\n');
    }

    set installString(v: string) {
        this.install = v.split('\n');
    }

    set installFilesString(v: string) {
        this.install_files = v.split('\n');
    }

    get installFilesString(): string {
        return this.install_files.join('\n');
    }
}

export class JobTaskConfig extends JobTaskConfigBase {
    /**
     * Will be set by config loader.
     */
    @t
    name: string = '';

    @t
    replicas: number = 1;

    @t.array(String)
    depends_on: string[] = [];

    /**
     * Will be set config loader
     */
    @t.map(Boolean)
    configValuesNoOverwrite: { [path: string]: true } = {};

    public isRoot(): boolean {
        return this.depends_on.length === 0;
    }
}

@Entity('job-config')
export class JobConfig extends JobTaskConfigBase {
    public static readonly inheritTaskProperties: string[] = [
        'install',
        'dockerfile',
        'install_files',
        'image',
        'environmentVariables',
        'clusters',
        'nodes',
        'nodeIds',
        'resources',
        'commands',
        'args',
        'output',
        'docker'
    ];

    @t.map(t.any)
    parameters: { [name: string]: any } = {};

    @t
    path: string = '';

    @t.array(String)
    ignore: string[] = [];

    @t
    priority: number = 0;

    @t
    import: string = '';

    @t.map(JobTaskConfig)
    protected tasks: { [name: string]: JobTaskConfig } = {};

    protected parametersArray?: { name: string, value: any }[];

    protected resolved = false;

    public getLabel(): string {
        if (!this.label && this.path) {
            let path = this.path;

            if (path.endsWith('.yaml')) path = path.substr(0, path.length - 5);
            if (path.endsWith('.yml')) path = path.substr(0, path.length - 4);

            const index = path.lastIndexOf('/');
            if (index !== -1) {
                path = path.substr(index + 1);
            }

            if (path === 'deepkit') {
                return 'Default';
            }

            return path;
        }

        return this.label;
    }


    /**
     * Writes all values of the root config into task config and the values from the original config (configValuesToOverwrite)
     * file to task config (so user can override them)
     */
    resolveInheritance() {
        for (const task of each(this.getTasks())) {
            for (const name of JobConfig.inheritTaskProperties) {
                if (task.configValuesNoOverwrite[name]) continue;
                (task as any)[name] = (this as any)[name];
            }
        }
    }

    public getTasks(): { [name: string]: JobTaskConfig } {
        if (Object.keys(this.tasks).length === 0) {
            this.tasks = {main: new JobTaskConfig};
            this.tasks.main.name = 'main';
        }

        if (!this.resolved) {
            this.resolved = true;
            this.resolveInheritance();
        }

        return this.tasks;
    }
}

export class JobEnvironmentPython {
    @t.optional
    version?: string;

    @t.optional
    binary?: string;

    @t.optional
    sdkVersion?: string;

    @t.map(String)
    pipPackages: { [name: string]: string } = {};
}

export class JobEnvironment {
    @t.optional
    hostname?: string;

    @t.optional
    username?: string;

    @t.optional
    platform?: string;

    @t.optional
    release?: string;

    @t.optional
    arch?: string;

    @t.optional
    uptime?: number;

    @t.optional
    nodeVersion?: string;

    @t.map(String).optional
    environmentVariables?: { [name: string]: string };

    @t.type(JobEnvironmentPython).optional
    python?: JobEnvironmentPython;
}

export class JobGit {
    @t.optional
    author?: string;

    @t.optional
    branch?: string;

    @t.optional
    origin?: string;

    constructor(
        @t.name('commit') public commit: string,
        @t.name('message') public message: string,
        @t.name('authorEmail').optional public authorEmail?: string,
        @t.name('date').optional public date?: Date,
    ) {
    }
}

export class JobDocker {
    @t.optional
    runOnVersion?: string;
}

export class JobDockerImage {
    @t.optional
    name?: string;

    @t.optional
    id?: string;

    @t.optional
    size?: number;

    @t.optional
    os?: string;

    @t.optional
    arch?: string;

    @t.optional
    created?: Date;

    @t.optional
    builtWithDockerVersion?: string;
}

//note: these codes are hardcoded in the SDKs as well
export enum JobStatus {
    creating = 0,
    created = 50, //when all files are attached

    running = 100,

    done = 150, //when all tasks are done
    aborted = 200, //when at least one task aborted

    failed = 250, //when at least one task failed
    crashed = 300, //when at least one task crashed
}

//note: these codes are hardcoded in the SDKs as well
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

//note: these codes are hardcoded in the SDKs as well
export enum JobTaskInstanceStatus {
    pending = 0,

    booting = 200, //is starting the job's task
    docker_pull = 220, //joining docker's network
    docker_build_await = 230, //joining docker's network
    docker_build = 235, //joining docker's network
    joining_network = 250, //joining docker's network
    checkout_files = 260, //download job files for that task instance

    started = 300,

    //beginning with that ended
    done = 500,
    aborted = 550,
    failed = 600,
    crashed = 650,
}

@Entity('job/channel')
export class Channel {
    /**
     * This might be empty.
     */
    @t.array(String)
    traces: string[] = [];

    @t.optional
    kpi?: boolean;

    @t
    kpiTrace: number = 0;

    @t
    maxOptimization: boolean = true;

    @t.array(t.any)
    lastValue: any[] = [];

    @t.any.optional
    xaxis?: object;

    @t.any.optional
    yaxis?: object;

    @t.any.optional
    layout?: object;
}

export enum PullStatsStatus {
    waiting = 'waiting',
    downloading = 'downloading',
    extracting = 'extracting',
    verifying = 'verifying',
    done = 'done',
}

export class PullStats {
    @t
    current: number = 0;

    @t
    total: number = 0;

    @t.enum(PullStatsStatus)
    status: PullStatsStatus = PullStatsStatus.waiting;

    constructor(
        @t.name('id') public readonly id: string
    ) {
    }
}

export class JobTaskInstance {
    @t.enum(JobTaskInstanceStatus)
    status: JobTaskInstanceStatus = JobTaskInstanceStatus.pending;

    @t
    uploadOutputCurrent: number = -1;

    @t
    uploadOutputTotal: number = 0;

    @t.type(JobEnvironment)
    environment: JobEnvironment = new JobEnvironment;

    @t.type(JobDocker)
    docker: JobDocker = new JobDocker;

    @t.map(PullStats)
    dockerPullStats: { [id: string]: PullStats } = {};

    @t.type(JobDockerImage)
    dockerImage: JobDockerImage = new JobDockerImage;

    @t.uuid.optional
    node?: string;

    @t.optional
    exitCode?: number;

    @t
    error: string = '';

    @t.type(JobAssignedResources)
    assignedResources: JobAssignedResources = new JobAssignedResources;

    @t.optional
    started?: Date;

    @t.optional
    ended?: Date;

    constructor(@t.name('id') public id: number) {
    }

    public getOrCreatePullStats(id: string): PullStats {
        if (!this.dockerPullStats[id]) {
            this.dockerPullStats[id] = new PullStats(id);
        }

        return this.dockerPullStats[id];
    }

    public isRunning() {
        return this.isStarted() && !this.isEnded();
    }

    public isStarted() {
        return this.status >= JobTaskInstanceStatus.booting;
    }

    public isEnded() {
        return this.status >= JobTaskInstanceStatus.done;
    }

    public isDockerPull() {
        return this.status === JobTaskInstanceStatus.docker_pull;
    }

    public elapsedTime(): number | undefined {
        if (this.ended && this.started) {
            return (this.ended.getTime() - this.started.getTime()) / 1000;
        }

        if (this.started) {
            return ((new Date).getTime() - this.started.getTime()) / 1000;
        }

        return undefined;
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
    @t.type(JobTaskQueue)
    queue: JobTaskQueue = new JobTaskQueue;

    @t.enum(JobTaskStatus)
    status: JobTaskStatus = JobTaskStatus.pending;

    @t.optional
    assigned?: Date;

    @t.optional
    started?: Date;

    @t.optional
    ended?: Date;

    @t.optional
    exitCode?: number;

    @t.array(JobTaskInstance)
    public instances: JobTaskInstance[] = [];

    constructor(
        @t.name('name') public name: string,
        replicas: number,
    ) {
        for (let i = 0; i < replicas; i++) {
            this.instances[i] = new JobTaskInstance(i);
        }
    }

    public elapsedTime(): number | undefined {
        if (this.ended && this.started) {
            return (this.ended.getTime() - this.started.getTime()) / 1000;
        }

        if (this.started) {
            return ((new Date).getTime() - this.started.getTime()) / 1000;
        }

        return undefined;
    }

    public getInstances(): JobTaskInstance[] {
        return this.instances;
    }

    public getRunningInstances(): JobTaskInstance[] {
        const result: JobTaskInstance[] = [];
        for (const instance of this.instances) {
            if (instance.isRunning()) result.push(instance);
        }
        return result;
    }

    public getFirstInstance(): JobTaskInstance | undefined {
        return this.instances[0];
    }

    public isErrored(): boolean {
        return this.status === JobTaskStatus.crashed
            || this.status === JobTaskStatus.failed
            || this.status === JobTaskStatus.aborted;
    }

    public getInstance(replica: number): JobTaskInstance {
        if (!this.instances[replica]) {
            throw new Error(`Replica #${replica} of task ${this.name} does not exist.`);
        }

        return this.instances[replica];
    }

    public isStarted() {
        return this.status >= JobTaskStatus.started;
    }

    public isQueued() {
        return this.status === JobTaskStatus.queued;
    }

    public isRunning() {
        return this.isStarted() && !this.isEnded();
    }

    public isEnded() {
        return this.status >= JobTaskStatus.done;
    }

    public areAllInstancesEnded(): boolean {
        return this.instances.every((instance) => {
            return instance.isEnded();
        });
    }

    public calculateStatusByInstances(): JobTaskStatus {
        let status = JobTaskStatus.done;

        for (const instance of this.instances) {
            if (status === JobTaskStatus.done) {
                //allowed to set to all

                if (instance.status === JobTaskInstanceStatus.aborted) {
                    status = JobTaskStatus.aborted;
                }
                if (instance.status === JobTaskInstanceStatus.failed) {
                    status = JobTaskStatus.failed;
                }
                if (instance.status === JobTaskInstanceStatus.crashed) {
                    status = JobTaskStatus.crashed;
                }
            }

            if (status === JobTaskStatus.aborted) {
                if (instance.status === JobTaskInstanceStatus.failed) {
                    status = JobTaskStatus.failed;
                }
                if (instance.status === JobTaskInstanceStatus.crashed) {
                    status = JobTaskStatus.crashed;
                }
            }
        }

        return status;
    }
}

@Entity('jobModelGraphSnapshot/histogram')
export class JobModelGraphSnapshotHistogram {
    @t.array(Number)
    x!: number[];

    @t.array(Number)
    y!: number[];
}


@Entity('jobModelGraphSnapshot/layer')
export class JobModelGraphSnapshotLayer {
    @t.optional
    saved?: Date;

    @t.optional
    outputFileId?: string;

    @t.type(JobModelGraphSnapshotHistogram).optional
    weights?: JobModelGraphSnapshotHistogram;

    @t.type(JobModelGraphSnapshotHistogram).optional
    biases?: JobModelGraphSnapshotHistogram;
}

@Entity('jobModelGraphSnapshot')
export class JobModelGraphSnapshot {
    @t.uuid
    id: string = uuid();

    @t
    version: number = 0;

    @t
    created: Date = new Date;

    @t
    iteration: number = 0;

    @t.index()
    live: boolean = false;

    @t.map(JobModelGraphSnapshotLayer)
    layerInfo: {[layerName: string]: JobModelGraphSnapshotLayer} = {};

    constructor(@t.uuid.index().name('job') public job: string) {
    }
}

export class JobModelNode {
    /**
     * Separated by /. Will be grouped together.
     */
    @t
    id!: string;

    @t
    label!: string;

    @t.optional
    type: string = ''; //op, dense, conv, concat, reshape, etc.

    @t.optional
    op?: string;

    @t.array(Number)
    shape: number[] = [];

    @t.map(t.any)
    attributes: { [name: string]: any } = {};

    /**
     * input ids from other nodes.
     */
    @t.array(String)
    input: string[] = [];

    /**
     * input ids from other nodes.
     */
    @t.array(JobModelNode)
    children: JobModelNode[] = [];

    public hasSelfActivation(): boolean {
        return this.attributes['activation'] && this.attributes['activation'] !== 'linear';
    }

    public isSmallBox() {
        return this.type === 'BatchNormalization' || this.type === 'Dropout' || this.type.includes('Padding') || this.type.includes('Pooling');
    }

    public hasBorder() {
        return !this.isSmallBox();
    }

    public isBorderRadius() {
        return this.type === 'Dense';
    }

    public isActivation() {
        return this.type === 'Activation';
    }
}

@Entity('job/model/graph')
export class JobModelGraph {
    @t.array(JobModelNode)
    nodes: JobModelNode[] = [];

    @t.array(String)
    inputs: string[] = [];

    @t.array(String)
    outputs: string[] = [];
}

@Entity('job', 'jobs')
export class Job implements IdInterface {
    @t.uuid.exclude('json')
    accessToken: string = uuid();

    @t
    number: number = 0;

    @t.index()
    version: number = 1;

    @t
    description: string = '';

    /**
     * The cluster id if assigned.
     */
    @t.uuid.optional
    cluster?: string;

    @t.index()
    connections: number = 0;

    @t
    created: Date = new Date();

    @t
    updated: Date = new Date();

    @t.optional
    author?: string;

    @t.type(JobConfig)
    config: JobConfig = new JobConfig;

    @t.type(JobGit).optional
    git?: JobGit;

    @t.optional
    configFile?: string;

    /**
     * Whether the job is executed directly in script without Deepkit CLI tools.
     */
    @t
    selfExecution: boolean = false;

    @t
    hasModelGraph: boolean = false;

    @t.uuid.optional
    liveSnapshotId?: string;

    @t.enum(JobStatus)
    status: JobStatus = JobStatus.creating;

    @t
    title: string = '';

    @t.map(t.any)
    infos: { [name: string]: any } = {};

    @t.map(JobTask)
    tasks: { [name: string]: JobTask } = {};

    //todo, move the content to a file
    @t.map(t.any)
    debugSnapshots: { [timestamp: number]: any } = {};

    @t.map(Boolean)
    debugActiveLayerWatching: { [layerId: string]: boolean } = {};

    @t
    runOnCluster: boolean = false;

    @t.array(String).index()
    tags: string[] = [];

    @t.optional
    assigned?: Date;

    @t.optional
    started?: Date;

    @t.optional
    ended?: Date;

    @t.optional
    stopRequested?: Date;

    @t.optional
    ping?: Date;

    //aka epochs
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

    constructor(
        @t.uuid.primary.name('id') public id: string,
        @t.uuid.index().name('project') public project: string,
    ) {
    }
}
