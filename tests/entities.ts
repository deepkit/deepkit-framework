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

    public isRoot(): boolean {
        return this.depends_on.length === 0;
    }
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

    public getParameters(): { name: string, value: any }[] {
        if (!this.parametersArray) {
            this.parametersArray = [];
            for (const [i, v] of eachPair(this.parameters)) {
                this.parametersArray.push({name: i, value: v});
            }
        }

        return this.parametersArray;
    }

    public getMainTask(): JobTaskConfig {
        const task = new JobTaskConfig;
        task.name = 'main';

        for (const name of JobConfig.inheritTaskProperties) {
            (task as { [field: string]: any })[name] = (this as { [field: string]: any })[name];
        }

        return task;
    }

    public hasTasks(): boolean {
        for (const i of eachKey(this.tasks)) {
            return true;
        }

        return false;
    }
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

    public isRunning() {
        return this.isStarted() && !this.isEnded();
    }

    public isStarted() {
        return this.status >= JobTaskInstanceStatus.booting;
    }

    public isEnded() {
        return this.status >= JobTaskInstanceStatus.done;
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

    // exitCodes: { [key: string]: number } = {};

    // @UUIDField()
    // server: string | null = null;

    @EnumField(JobTaskStatus)
    status: JobTaskStatus = JobTaskStatus.pending;

    // @Field(JobAssignedResources)
    // assignedResources: JobAssignedResources = new JobAssignedResources;

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

    public elapsedTime(): number | undefined {
        if (this.ended && this.started) {
            return (this.ended.getTime() - this.started.getTime()) / 1000;
        }

        if (this.started) {
            return ((new Date).getTime() - this.started.getTime()) / 1000;
        }

        return undefined;
    }

    public getKpiChannelName(): string | undefined {
        for (const [i, channel] of eachPair(this.channels)) {
            if (channel.kpi) {
                return i;
            }
        }
    }

    public addInfo(name: string, value: any) {
        this.infos.add(name, value);
    }

    public isRunning() {
        return this.isStarted() && !this.isEnded();
    }

    public isStarted() {
        return this.status >= JobStatus.running;
    }

    public isEnded() {
        return this.status >= JobStatus.done;
    }

    public isAlive() {
        if (this.ended) {
            return false;
        }

        if (this.started && this.ping) {
            const diffSeconds = (Date.now() - this.ping.getTime()) / 1000;
            return diffSeconds < 15;
        }

        if (this.started) {
            return true;
        }

        return false;
    }

    public runInDocker() {
        return !!this.config.image;
    }

    public isConnectionLost() {
        if (this.started && !this.ended && this.ping) {
            const diffSeconds = (Date.now() - this.ping.getTime()) / 1000;
            return diffSeconds > 5;
        }

        return false;
    }

    public createChannel(id: string, traceName: string[],
                         main: boolean = false,
                         kpi: boolean = false,
                         kpiTrace = 0,
                         maxOptimization: boolean = true,
                         xaxis: object = {},
                         yaxis: object = {},
                         layout: object = {},
    ) {
        const channel = new Channel();
        channel.traces = traceName;
        channel.main = main;
        channel.kpi = kpi;
        channel.kpiTrace = kpiTrace;
        channel.maxOptimization = maxOptimization;
        channel.lastValue = [];
        channel.xaxis = xaxis;
        channel.yaxis = yaxis;
        channel.layout = layout;

        this.channels[id] = channel;
    }

    public getChannel(id: string): Channel {
        return this.channels[id];
    }

    public getTaskConfig(name: string): JobTaskConfig {
        if (!this.config.hasTasks() && name === 'main') {
            return this.config.getMainTask();
        } else {
            //no main task and we have tasks defined
            if (!this.config.tasks[name]) {
                throw new Error(`Task '${name}' does not exist.`);
            }

            return this.config.tasks[name];
        }
    }

    public getLatestTaskInstance(): { task: string | undefined, instance: number | undefined } {
        let latest: JobTask | undefined;
        for (const task of this.getAllTasks()) {
            if (!latest) {
                latest = task;
            }
            if (latest && task.isStarted() && task.started && latest.started && task.started >= latest.started) {
                latest = task;
            }
        }

        if (latest) {
            const running = latest.getRunningInstances();
            if (running.length > 0) {
                return {
                    task: latest.name,
                    instance: running[0].id,
                };
            } else {
                return {
                    task: latest.name,
                    instance: latest.getInstances()[0].id,
                };
            }
        }

        return {
            task: undefined,
            instance: undefined,
        };
    }

    public prepareTaskInstances() {
        this.tasks = {};

        for (const task of this.getAllTaskConfigs()) {
            this.tasks[task.name] = new JobTask(task.name, task.replicas);
        }
    }

    public getTask(name: string): JobTask {
        if (!this.tasks[name]) {
            throw new Error(`Task '${name}' does not exist.`);
        }

        return this.tasks[name];
    }

    public getQueuedRootTasks(): JobTask[] {
        const list: JobTask[] = [];

        for (const taskConfig of this.getAllTaskConfigs()) {
            const task = this.tasks[taskConfig.name];

            if (taskConfig.isRoot() && task.isQueued()) {
                list.push(task);
            }
        }

        return list;
    }

    /**
     * Returns true if there is at least one task that can be started but can't yet because of unmet dependencies.
     * This excludes tasks where dependencies crashed/aborted/failed. This means if one task crashed in the middle of
     * the dependency graph this returns false.
     */
    public hasPendingTasks(): boolean {
        for (const taskConfig of this.getAllTaskConfigs()) {
            const info = this.getTask(taskConfig.name);

            if (!info.isEnded() && this.isTaskDependenciesValid(taskConfig.name)) {
                return true;
            }
        }

        return false;
    }

    public calculateStatusByTasks(): JobStatus {
        let status = JobStatus.done;

        for (const task of this.getAllTasks()) {
            if (status === JobStatus.done) {
                //allowed to set to all

                if (task.status === JobTaskStatus.aborted) {
                    status = JobStatus.aborted;
                }
                if (task.status === JobTaskStatus.failed) {
                    status = JobStatus.failed;
                }
                if (task.status === JobTaskStatus.crashed) {
                    status = JobStatus.crashed;
                }
            }

            if (status === JobStatus.aborted) {
                if (task.status === JobTaskStatus.failed) {
                    status = JobStatus.failed;
                }
                if (task.status === JobTaskStatus.crashed) {
                    status = JobStatus.crashed;
                }
            }
        }

        return status;
    }

    /**
     * Returns true if at least one task errored (crashed, failed, or aborted)
     */
    public hasErroredTasks(): boolean {
        for (const task of this.getAllTasks()) {
            if (task.isErrored()) return true;
        }

        return false;
    }

    /**
     * Returns the task that errored (crashed, failed, or aborted)
     */
    public getErroredTask(): JobTask | undefined {
        for (const task of this.getAllTasks()) {
            if (task.isErrored()) return task;
        }
    }

    public getAllTasks(): JobTask[] {
        const tasks: JobTask[] = [];

        for (const task of each(this.tasks)) {
            tasks.push(task);
        }

        return tasks;
    }

    public getInstancesFor(task: string): JobTaskInstance[] {
        return this.tasks[task] ? this.tasks[task].getInstances() : [];
    }

    public getInstanceFor(task: string, replica: number): JobTaskInstance {
        return this.tasks[task].getInstance(replica);
    }

    public getRunningInstances(task: string): JobTaskInstance[] {
        return this.tasks[task].getRunningInstances();
    }

    public getAllTaskConfigs(): JobTaskConfig[] {
        if (!this.config.hasTasks()) {
            const main = this.config.getMainTask();
            return [main];
        }

        return Object.values(this.config.tasks);
    }

    /**
     * Returns only job tasks that should and can be started (dependencies met).
     */
    public getNextTasksToStart(): JobTask[] {
        if (!this.config.hasTasks()) {
            const main = this.config.getMainTask();
            const info = this.getTask(main.name);

            if (!info.isStarted()) {
                return [info];
            }

            return [];
        }

        const nextTasks: JobTask[] = [];
        for (const taskConfig of each(this.config.tasks)) {
            const info = this.getTask(taskConfig.name);

            if (info.isStarted()) {
                continue;
            }

            if (this.isTaskDependenciesMet(taskConfig.name)) {
                nextTasks.push(info);
            }
        }

        return nextTasks;
    }

    /**
     * Checks whether all dependencies are valid, which means: not crashed, aborted, or failed.
     */
    public isTaskDependenciesValid(name: string): boolean {
        for (const dependsOnInfo of this.getDependencies(name)) {
            if (dependsOnInfo.isErrored()) {
                return false;
            }
        }

        return true;
    }

    public getDependencies(name: string) {
        const list: JobTask[] = [];

        if (!this.config.tasks[name]) {
            throw new Error(`Task '${name}' does not exist.`);
        }

        const config = this.config.tasks[name];

        for (const depends_on of config.depends_on) {
            if (!this.tasks[depends_on]) {
                throw new Error(`Task '${name}' depends on '${depends_on}' which does not exist.`);
            }

            list.push(this.tasks[depends_on]);
        }

        return list;
    }

    public isTaskDependenciesMet(name: string): boolean {
        for (const dependsOnInfo of this.getDependencies(name)) {
            if (dependsOnInfo.status !== JobTaskStatus.done) {
                //a dependent task is not finished, so this task is not allowed to run
                return false;
            }
        }

        //no depends_on, so allowed to run
        return true;
    }
}
