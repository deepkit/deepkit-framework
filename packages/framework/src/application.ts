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

import { ClassType } from '@deepkit/core';
import { KernelModule } from './kernel';
import { ServiceContainer } from './service-container';
import { ProviderWithScope } from './injector/provider';
import { createModule, Module, ModuleConfigOfOptions, ModuleOptions } from './module';
import { Command, Config, Options } from '@oclif/config';
import { basename, relative } from 'path';
import { Main } from '@oclif/command';
import { ExitError } from '@oclif/errors';
import { buildOclifCommand } from './command';

export class Application<T extends ModuleOptions<any>> {
    public readonly serviceContainer: ServiceContainer<T>;

    constructor(
        appModule: Module<T>,
        providers: ProviderWithScope[] = [],
        imports: Module<any>[] = [],
    ) {
        imports = imports.slice(0);

        if (!appModule.hasImport(KernelModule)) {
            appModule.addImport(KernelModule);
        }

        this.serviceContainer = new ServiceContainer(appModule, providers, imports);
    }

    static create<T extends Module<any> | ModuleOptions<any>, C = T extends Module<infer K> ? K : T>(module: T): Application<C> {
        if (module instanceof Module) {
            return new Application(module as any);
        } else {
            //see: https://github.com/microsoft/TypeScript/issues/13995
            const mod = module as any as ModuleOptions<any>;
            return new Application<C>(createModule(mod) as any);
        }
    }

    configure(config: ModuleConfigOfOptions<T>): this {
        throw new Error('Not implemented yet.');
    }

    loadConfigFromEnvFile(path: string | string[]): this {
        throw new Error('Not implemented yet.');
    }

    loadConfigFromEnvVariables(prefix: string = ''): this {
        throw new Error('Not implemented yet.');
    }

    loadConfigFromEnvVariable(variableName: string): this {
        throw new Error('Not implemented yet.');
    }

    async run(argv?: any[]) {
        await this.execute(argv ?? process.argv.slice(2));
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T): R {
        return this.serviceContainer.rootInjectorContext.getInjector(0).get(token);
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

        try {
            const config = new MyConfig({ root: import.meta.url.replace('file://', '') });
            for (const [name, controller] of this.serviceContainer.cliControllers.controllers.entries()) {
                config.commandsMap[name] = buildOclifCommand(controller, this.serviceContainer.rootInjectorContext);
            }

            await Main.run(argv, config);
        } catch (e) {
            if (e instanceof ExitError) {
                process.exit(e.oclif.exit);
            } else {
                console.log(e);
            }
        }
        return result;
    }
}
