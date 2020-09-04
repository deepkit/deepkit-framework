import {applyDefaults, ClassType} from '@super-hornet/core';
import {WebWorker} from './worker';
import {SuperHornetBaseModule} from './super-hornet-base.module';
import {ProviderWithScope, ServiceContainer} from './service-container';
import {DynamicModule, hornet, ModuleOptions} from './decorator';
import {Command, Config, Options} from '@oclif/config';
import {basename, relative} from 'path';
import {Main} from '@oclif/command';
import {buildOclifCommand} from './command';
import {ApplicationConfig} from './application-config';
import {Router, RouterControllers} from './router';

export class Application {
    protected config: ApplicationConfig;
    protected masterWorker?: WebWorker;
    protected serviceContainer = new ServiceContainer;

    constructor(
        appModule: ClassType,
        config: Partial<ApplicationConfig> = {},
        providers: ProviderWithScope[] = [],
        imports: (ClassType | DynamicModule)[] = [],
    ) {
        this.config = applyDefaults(ApplicationConfig, config);
        providers.push(
            {provide: ApplicationConfig, useValue: this.config},
        );

        imports.unshift(SuperHornetBaseModule.forRoot());
        this.serviceContainer.processRootModule(appModule, providers, imports);

        for (const module of this.serviceContainer.getRegisteredModules()) {
            if (module.onBootstrap) {
                module.onBootstrap();
            }
        }
    }

    static root(module: ModuleOptions) {
        @hornet.module(module)
        class MyModule {

        }

        return new Application(MyModule);
    }

    public async shutdown() {
        for (const module of this.serviceContainer.getRegisteredModules()) {
            if (module.onShutDown) {
                await module.onShutDown();
            }
        }
    }

    getInjector() {
        return this.serviceContainer.getRootContext().getInjector();
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T): R {
        return this.serviceContainer.getRootContext().getInjector().get(token);
    }

    public async run() {
        return this.execute(process.argv.slice(2));
    }

    public async execute(argv: string[]) {
        let result: any;
        class MyConfig extends Config {
            commandsMap: { [name: string]: Command.Plugin } = {};

            constructor(options: Options) {
                super(options);
                this.root = options.root;
                this.userAgent = 'Node';
                this.name = 'app';
                const bin = basename(process.argv[0]);
                this.bin = `${bin} ${relative(process.cwd(), process.argv[1]) || '.'}`;
                this.version = '0.0.1';
                this.pjson = {
                    name: this.name,
                    version: this.version,
                    oclif: {
                        update: {
                            s3: {} as any,
                            node: {}
                        }
                    }
                };
            }

            runHook<T>(event: string, opts: T): Promise<void> {
                if (event === 'postrun') {
                    result = (opts as any).result;
                }
                return super.runHook(event, opts);
            }

            findCommand(id: string, opts?: {
                must: boolean;
            }) {
                return this.commandsMap[id]!;
            }

            get commandIDs() {
                return Object.keys(this.commandsMap);
            }

            get commands() {
                return Object.values(this.commandsMap);
            }
        }

        const config = new MyConfig({root: __dirname});

        for (const [name, controller] of this.serviceContainer.cliControllers.entries()) {
            config.commandsMap[name] = buildOclifCommand(controller);
        }

        await Main.run(argv, config);
        return result;
    }
}
