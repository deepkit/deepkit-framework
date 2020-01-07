import {
    Entity, f,
    uuid,
} from "@marcj/marshal";
import {each, eachPair} from "@marcj/estdlib";
import {IdInterface} from "..";

@Entity('JobAssignedResourcesGpu')
export class JobAssignedResourcesGpu {
    constructor(
        @f.asName('uuid') public uuid: string,
        @f.asName('name') public name: string,
        @f.asName('memory') public memory: number,
    ) {
    }
}


@Entity('JobAssignedResources')
export class JobAssignedResources {
    @f
    cpu: number = 0;

    @f
    memory: number = 0;

    @f.array(JobAssignedResourcesGpu)
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
    @f.array(String)
    env: string[] = []; //e.g. ["PATH=bla"]

    @f.array(String)
    binds: string[] = []; //e.g. ["/tmp:/tmp"]

    @f.array(String)
    links: string[] = []; //e.g. ["redis3:redis"]
}

export class JobResources {
    @f
    minCpu: number = 0;

    @f
    maxCpu: number = 0;

    @f
    cpu: number = 0;

    @f
    allMemory: boolean = true;

    @f
    minMemory: number = 0;

    @f
    maxMemory: number = 0;

    @f
    memory: number = 0;


    @f
    minGpu: number = 0;

    @f
    maxGpu: number = 0;

    @f
    gpu: number = 0;

    /**
     * Value in GB. Defines minimum gpu memory that is necessary.
     */
    @f
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
        @f.asName('name')
        public name: string = '',
        @f.asName('command')
        public command: string = '',
    ) {
    }
}

export class JobTaskConfigBase {
    @f
    label: string = '';

    @f.array(String)
    install: string[] = [];

    @f
    dockerfile: string = '';

    @f.array(String)
    install_files: string[] = [];

    @f
    image: string = '';

    @f.array(String)
    output: string[] = [];

    @f.array(String)
    environmentVariables: string[] = [];

    @f.array(String)
    nodeIds: string[] = [];

    @f.array(String)
    nodes: string[] = [];

    @f.array(String)
    clusters: string[] = [];

    @f.array(JobTaskCommand)
    commands: JobTaskCommand[] = [];

    @f.array(String)
    args: string[] = [];

    @f.type(JobResources)
    resources: JobResources = new JobResources;

    @f.type(JobConfigDocker)
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
    @f
    name: string = '';

    @f
    replicas: number = 1;

    @f.array(String)
    depends_on: string[] = [];

    /**
     * Will be set config loader
     */
    @f.type(Boolean).asMap()
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

    @f.any().asMap()
    parameters: { [name: string]: any } = {};

    @f
    path: string = '';

    @f.array(String)
    ignore: string[] = [];

    @f
    priority: number = 0;

    @f
    import: string = '';

    @f.map(JobTaskConfig)
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
    @f.optional()
    version?: string;

    @f.optional()
    binary?: string;

    @f.optional()
    sdkVersion?: string;

    @f.map(String)
    pipPackages: { [name: string]: string } = {};
}

export class JobEnvironment {
    @f.optional()
    hostname?: string;

    @f.optional()
    username?: string;

    @f.optional()
    platform?: string;

    @f.optional()
    release?: string;

    @f.optional()
    arch?: string;

    @f.optional()
    uptime?: number;

    @f.optional()
    nodeVersion?: string;

    @f.map(String).optional()
    environmentVariables?: { [name: string]: string };

    @f.type(JobEnvironmentPython).optional()
    python?: JobEnvironmentPython;
}

export class JobGit {
    @f.optional()
    author?: string;

    @f.optional()
    branch?: string;

    @f.optional()
    origin?: string;

    constructor(
        @f.asName('commit') public commit: string,
        @f.asName('message') public message: string,
        @f.asName('authorEmail').optional() public authorEmail?: string,
        @f.asName('date').optional() public date?: Date,
    ) {
    }
}

export class JobDocker {
    @f.optional()
    runOnVersion?: string;
}

export class JobDockerImage {
    @f.optional()
    name?: string;

    @f.optional()
    id?: string;

    @f.optional()
    size?: number;

    @f.optional()
    os?: string;

    @f.optional()
    arch?: string;

    @f.optional()
    created?: Date;

    @f.optional()
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
    @f.array(String)
    traces: string[] = [];

    @f.optional()
    kpi?: boolean;

    @f
    kpiTrace: number = 0;

    @f
    maxOptimization: boolean = true;

    @f.any().asArray()
    lastValue: any[] = [];

    @f.any().optional()
    xaxis?: object;

    @f.any().optional()
    yaxis?: object;

    @f.any().optional()
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
    @f
    current: number = 0;

    @f
    total: number = 0;

    @f.enum(PullStatsStatus)
    status: PullStatsStatus = PullStatsStatus.waiting;

    constructor(
        @f.asName('id') public readonly id: string
    ) {
    }
}

export class JobTaskInstance {
    @f.enum(JobTaskInstanceStatus)
    status: JobTaskInstanceStatus = JobTaskInstanceStatus.pending;

    @f
    uploadOutputCurrent: number = -1;

    @f
    uploadOutputTotal: number = 0;

    @f.type(JobEnvironment)
    environment: JobEnvironment = new JobEnvironment;

    @f.type(JobDocker)
    docker: JobDocker = new JobDocker;

    @f.map(PullStats)
    dockerPullStats: { [id: string]: PullStats } = {};

    @f.type(JobDockerImage)
    dockerImage: JobDockerImage = new JobDockerImage;

    @f.uuid().optional()
    node?: string;

    @f.optional()
    exitCode?: number;

    @f
    error: string = '';

    @f.type(JobAssignedResources)
    assignedResources: JobAssignedResources = new JobAssignedResources;

    @f.optional()
    started?: Date;

    @f.optional()
    ended?: Date;

    constructor(@f.asName('id') public id: number) {
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
    @f.type(JobTaskQueue)
    queue: JobTaskQueue = new JobTaskQueue;

    @f.enum(JobTaskStatus)
    status: JobTaskStatus = JobTaskStatus.pending;

    @f.optional()
    assigned?: Date;

    @f.optional()
    started?: Date;

    @f.optional()
    ended?: Date;

    @f.optional()
    exitCode?: number;

    @f.array(JobTaskInstance)
    public instances: JobTaskInstance[] = [];

    constructor(
        @f.asName('name') public name: string,
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
    @f.array(Number)
    x!: number[];

    @f.array(Number)
    y!: number[];
}


@Entity('jobModelGraphSnapshot/layer')
export class JobModelGraphSnapshotLayer {
    @f.optional()
    saved?: Date;

    @f.optional()
    outputFileId?: string;

    @f.type(JobModelGraphSnapshotHistogram).optional()
    weights?: JobModelGraphSnapshotHistogram;

    @f.type(JobModelGraphSnapshotHistogram).optional()
    biases?: JobModelGraphSnapshotHistogram;
}

@Entity('jobModelGraphSnapshot')
export class JobModelGraphSnapshot {
    @f.uuid()
    id: string = uuid();

    @f
    version: number = 0;

    @f
    created: Date = new Date;

    @f
    iteration: number = 0;

    @f.index()
    live: boolean = false;

    @f.type(JobModelGraphSnapshotLayer).asMap()
    layerInfo: {[layerName: string]: JobModelGraphSnapshotLayer} = {};

    constructor(@f.uuid().index().asName('job') public job: string) {
    }
}

export class JobModelNode {
    /**
     * Separated by /. Will be grouped together.
     */
    @f
    id!: string;

    @f
    label!: string;

    @f.optional()
    type: string = ''; //op, dense, conv, concat, reshape, etc.

    @f.optional()
    op?: string;

    @f.array(Number)
    shape: number[] = [];

    @f.any().asMap()
    attributes: { [name: string]: any } = {};

    /**
     * input ids from other nodes.
     */
    @f.type(String).asArray()
    input: string[] = [];

    /**
     * input ids from other nodes.
     */
    @f.type(JobModelNode).asArray()
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
    @f.type(JobModelNode).asArray()
    nodes: JobModelNode[] = [];

    @f.type(String).asArray()
    inputs: string[] = [];

    @f.type(String).asArray()
    outputs: string[] = [];
}

@Entity('job', 'jobs')
export class Job implements IdInterface {
    @f.uuid().exclude('plain')
    accessToken: string = uuid();

    @f
    number: number = 0;

    @f.index()
    version: number = 1;

    @f
    description: string = '';

    /**
     * The cluster id if assigned.
     */
    @f.uuid().optional()
    cluster?: string;

    @f.index()
    connections: number = 0;

    @f
    created: Date = new Date();

    @f
    updated: Date = new Date();

    @f.optional()
    author?: string;

    @f.type(JobConfig)
    config: JobConfig = new JobConfig;

    @f.type(JobGit).optional()
    git?: JobGit;

    @f.optional()
    configFile?: string;

    /**
     * Whether the job is executed directly in script without Deepkit CLI tools.
     */
    @f
    selfExecution: boolean = false;

    @f
    hasModelGraph: boolean = false;

    @f.uuid().optional()
    liveSnapshotId?: string;

    @f.enum(JobStatus)
    status: JobStatus = JobStatus.creating;

    @f
    title: string = '';

    @f.any().asMap()
    infos: { [name: string]: any } = {};

    @f.map(JobTask)
    tasks: { [name: string]: JobTask } = {};

    //todo, move the content to a file
    @f.any().asMap()
    debugSnapshots: { [timestamp: number]: any } = {};

    @f.type(Boolean).asMap()
    debugActiveLayerWatching: { [layerId: string]: boolean } = {};

    @f
    runOnCluster: boolean = false;

    @f.type(String).asArray().index()
    tags: string[] = [];

    @f.optional()
    assigned?: Date;

    @f.optional()
    started?: Date;

    @f.optional()
    ended?: Date;

    @f.optional()
    stopRequested?: Date;

    @f.optional()
    ping?: Date;

    //aka epochs
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

    constructor(
        @f.uuid().primary().asName('id') public id: string,
        @f.uuid().index().asName('project') public project: string,
    ) {
    }
}
