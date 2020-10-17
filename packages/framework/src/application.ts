import {applyDefaults, ClassType} from '@deepkit/core';
import {WebWorker} from './worker';
import {BaseModule} from './base.module';
import {ProviderWithScope, ServiceContainer} from './service-container';
import {deepkit, DynamicModule, ModuleOptions} from './decorator';
import {Command, Config, Options} from '@oclif/config';
import {basename, relative} from 'path';
import {Main} from '@oclif/command';
import {ExitError} from '@oclif/errors';
import {buildOclifCommand} from './command';
import {ApplicationConfig} from './application-config';
import {Configuration} from './configuration';

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

        imports.unshift(BaseModule.forRoot());

        const configuration = new Configuration();
        configuration.loadEnvFile('.env');

        for (const name of configuration.getKeys()) {
            providers.push({provide: 'config.' + name, useValue: configuration.get(name)});
        }

        for (const name of Object.keys(this.config)) {
            providers.push({provide: 'config.' + name, useValue: (this.config as any)[name]});
        }

        providers.push({provide: Configuration, useValue: configuration});

        this.serviceContainer.processRootModule(appModule, providers, imports);

        for (const module of this.serviceContainer.getRegisteredModules()) {
            if (module.onBootstrap) {
                module.onBootstrap();
            }
        }
    }

    static root(module: ModuleOptions, config: Partial<ApplicationConfig> = {}) {
        @deepkit.module(module)
        class MyModule {

        }

        return new Application(MyModule, config);
    }

    static async run(module: ModuleOptions, config: Partial<ApplicationConfig> = {}) {
        return this.root(module, config).execute(process.argv.slice(2));
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

        try {
            await Main.run(argv, config);
        } catch (e) {
            if (e instanceof ExitError) {
                process.exit(e.oclif.exit);
            } else {
                throw e;
            }
        }
        return result;
    }
}
