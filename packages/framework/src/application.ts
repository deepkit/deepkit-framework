/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {applyDefaults, ClassType, isPlainObject} from '@deepkit/core';
import {WebWorker} from './worker';
import {KernelModule} from './kernel';
import {ProviderWithScope, ServiceContainer} from './service-container';
import {ModuleOptions} from './decorator';
import {Command, Config, Options} from '@oclif/config';
import {basename, relative} from 'path';
import {Main} from '@oclif/command';
import {ExitError} from '@oclif/errors';
import {buildOclifCommand} from './command';
import {ApplicationConfig} from './application-config';
import {Configuration} from './configuration';
import {createModule, Module, ModuleConfigOfOptions} from './module';

function isModule(module: any): module is Module<any> {
    return module instanceof Module;
}
function isModuleOptions(module: any): module is ModuleOptions {
    return isPlainObject(module);
}

export class Application<T extends ModuleOptions> {
    protected config: ApplicationConfig;
    protected masterWorker?: WebWorker;
    protected serviceContainer = new ServiceContainer;

    constructor(
        appModule: Module<T>,
        config: Partial<ApplicationConfig> = {},
        providers: ProviderWithScope[] = [],
        imports: Module<any>[] = [],
    ) {
        this.config = applyDefaults(ApplicationConfig, config);
        providers.push(
            {provide: ApplicationConfig, useValue: this.config},
        );

        imports = imports.slice(0);
        imports.unshift(KernelModule.forRoot());

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

    static create<T extends Module<any> | ModuleOptions>(module: T): Application<T extends Module<infer K> ? K : T> {
        if (module instanceof Module){
            return new Application(module);
        } else {
            //see: https://github.com/microsoft/TypeScript/issues/13995
            const mod = module as any as ModuleOptions;
            if (!mod.name) mod.name = 'app';
            return new Application(createModule(mod));
        }
    }

    configure(config: Partial<ModuleConfigOfOptions<T>>): this {
        return this;
    }

    loadConfigFromEnvFile(path: string | string[]): this {
        throw new Error('Not implemented yet.');
        return this;
    }

    loadConfigFromEnvVariables(prefix: string = ''): this {
        throw new Error('Not implemented yet.');
        return this;
    }

    loadConfigFromEnvVariable(variableName: string): this {
        throw new Error('Not implemented yet.');
        return this;
    }

    async run(argv?: any[]) {
        await this.execute(argv ?? process.argv.slice(2));
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
