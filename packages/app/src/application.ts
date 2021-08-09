/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, isArray, isFunction, isObject, setPathValue } from '@deepkit/core';
import { ConfigLoader, ServiceContainer } from './service-container';
import { ProviderWithScope } from '@deepkit/injector';
import { AppModule, ModuleConfigOfOptions, ModuleOptions } from './module';
import { Command, Config, Options } from '@oclif/config';
import { basename, relative } from 'path';
import { Main } from '@oclif/command';
import { ExitError } from '@oclif/errors';
import { buildOclifCommand } from './command';
import { ClassSchema } from '@deepkit/type';
import { EnvConfiguration } from './configuration';

export function setPartialConfig(target: { [name: string]: any }, partial: { [name: string]: any }, incomingPath: string = '') {
    for (const i in partial) {
        const path = (incomingPath ? incomingPath + '.' : '') + i;
        if (isObject(partial[i])) {
            setPartialConfig(target, partial[i], path);
        } else {
            setPathValue(target, path, partial[i]);
        }
    }
}

type EnvNamingStrategy = 'same' | 'upper' | 'lower' | ((name: string) => string | 'same' | 'upper' | 'lower' | undefined);

function camelToUpperCase(str: string) {
    return str.replace(/[A-Z]+/g, (letter: string) => `_${letter.toUpperCase()}`).toUpperCase();
}
function camelToLowerCase(str: string) {
    return str.replace(/[A-Z]+/g, (letter: string) => `_${letter.toLowerCase()}`).toLowerCase();
}

function parseEnv(
    config: { [name: string]: any },
    prefix: string,
    schema: ClassSchema,
    incomingDotPath: string,
    incomingEnvPath: string,
    namingStrategy: EnvNamingStrategy,
    envContainer: { [name: string]: any }
) {
    for (const property of schema.getProperties()) {
        const strategy = isFunction(namingStrategy) ? namingStrategy(property.name) || 'same' : namingStrategy;
        let name = property.name;
        if (strategy === 'upper') {
            name = camelToUpperCase(property.name);
        } else if (strategy === 'lower') {
            name = camelToLowerCase(property.name);
        } else if (strategy !== 'same') {
            name = strategy;
        }

        if (property.type === 'class') {
            parseEnv(
                config,
                prefix,
                property.getResolvedClassSchema(),
                (incomingDotPath ? incomingDotPath + '.' : '') + property.name,
                (incomingEnvPath ? incomingEnvPath + '_' : '') + name,
                namingStrategy,
                envContainer
            );
        } else {
            const dotPath = (incomingDotPath ? incomingDotPath + '.' : '') + property.name;
            const envName = prefix + (incomingEnvPath ? incomingEnvPath + '_' : '') + name;

            if (envContainer[envName] === undefined) continue;

            setPathValue(config, dotPath, envContainer[envName]);
        }
    }
}

export class CommandApplication<T extends ModuleOptions, C extends ServiceContainer<T> = ServiceContainer<T>> {
    constructor(
        public appModule: AppModule<T, any>,
        providers: ProviderWithScope<any>[] = [],
        imports: AppModule<any, any>[] = [],
        public readonly serviceContainer: ServiceContainer<T> = new ServiceContainer(appModule, providers, imports.slice(0))
    ) {
    }

    setup(...args: Parameters<this['appModule']['setup']>): this {
        this.serviceContainer.appModule = (this.serviceContainer.appModule.setup as any)(...args as any[]);
        return this;
    }

    addConfigLoader(loader: ConfigLoader): this {
        this.serviceContainer.addConfigLoader(loader);
        return this;
    }

    configure(config: ModuleConfigOfOptions<T>): this {
        const appConfig: any = {};
        const moduleConfigs: { [name: string]: any } = {};
        const moduleNames = this.serviceContainer.getRootInjectorContext().getModuleNames();

        for (const i in config) {
            let name = i;
            const separator = name.indexOf('_');
            let module = '';
            if (separator > 0) {
                module = name.substr(0, separator);
                name = name.substr(separator + 1);
            }
            if (module) {
                if (!moduleConfigs[module]) moduleConfigs[module] = {};
                moduleConfigs[module][name] = config[i as keyof typeof config];
            } else {
                if (moduleNames.includes(name)) {
                    moduleConfigs[name] = config[i as keyof typeof config];
                } else {
                    appConfig[name] = config[i as keyof typeof config];
                }
            }
        }

        this.serviceContainer.appModule.setConfig(appConfig);

        for (const i in moduleConfigs) {
            for (const module of this.serviceContainer.getModulesForName(i)) {
                module.setConfig(moduleConfigs[i]);
            }
        }

        return this;
    }

    /**
     * Loads a .env file and sets its configuration value.
     *
     * `path` is either an absolute or relative path. For relative paths the first
     * folder with a package.json starting from process.cwd() upwards is picked.
     *
     * So if you use 'local.env' make sure a 'local.env' file is localed beside your 'package.json'.
     *
     * `path` can be an array of paths. First existing path is picked.
     */
    loadConfigFromEnvFile(path: string | string[], namingStrategy: EnvNamingStrategy = 'same'): this {
        this.addConfigLoader({
            load(moduleName: string, config: { [p: string]: any }, schema: ClassSchema) {
                const envConfiguration = new EnvConfiguration();
                const paths = isArray(path) ? path : [path];
                for (const path of paths) {
                    if (envConfiguration.loadEnvFile(path)) break;
                }
                const all = envConfiguration.getAll() as any;

                parseEnv(config, '', schema, '', moduleName, namingStrategy, all);
            }
        });

        return this;
    }

    /**
     * Load all environment variables that start with given prefix and try to
     * find matching configuration options and set its value.
     *
     * Example:
     *
     * APP_databaseUrl="mongodb://localhost/mydb"
     *
     * Application.run().loadConfigFromEnvVariables('APP_').run();
     */
    loadConfigFromEnvVariables(prefix: string = 'APP_', namingStrategy: EnvNamingStrategy = 'same'): this {
        this.addConfigLoader({
            load(moduleName: string, config: { [p: string]: any }, schema: ClassSchema) {
                parseEnv(config, prefix, schema, '', moduleName, namingStrategy, process.env);
            }
        });
        return this;
    }

    /**
     * Loads a JSON encoded environment variable and applies its content to the configuration.
     *
     * Example:
     *
     * APP_CONFIG={'databaseUrl": "mongodb://localhost/mydb", "moduleA": {"foo": "bar'}}
     *
     * Application.run().loadConfigFromEnvVariable('APP_CONFIG').run();
     */
    loadConfigFromEnvVariable(variableName: string = 'APP_CONFIG'): this {
        if (!process.env[variableName]) return this;

        this.addConfigLoader({
            load(moduleName: string, config: { [p: string]: any }, schema: ClassSchema) {
                try {
                    const jsonConfig = JSON.parse(process.env[variableName] || '');

                    setPartialConfig(config, moduleName ? jsonConfig[moduleName] : jsonConfig);
                } catch (error) {
                    throw new Error(`Invalid JSON in env variable ${variableName}. Parse error: ${error}`);
                }
            }
        });
        return this;
    }

    async run(argv?: any[]) {
        const exitCode = await this.execute(argv ?? process.argv.slice(2), argv ? [] : process.argv.slice(0, 2));
        if (exitCode > 0) process.exit(exitCode);
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T): R {
        return this.serviceContainer.getRootInjectorContext().getInjector(0).get(token);
    }

    public async execute(argv: string[], binPaths: string[] = []): Promise<number> {
        this.serviceContainer.process();
        let result: any;

        class MyConfig extends Config {
            commandsMap: { [name: string]: Command.Plugin } = {};

            constructor(options: Options) {
                super(options);
                this.root = options.root;
                this.userAgent = 'Node';
                this.name = 'app';

                const bin = basename(binPaths[0]);
                if (binPaths.length === 2) {
                    if (bin === 'ts-node-script') {
                        this.bin = `${relative(process.cwd(), binPaths[1]) || '.'}`;
                    } else {
                        this.bin = `${bin} ${relative(process.cwd(), binPaths[1]) || '.'}`;
                    }
                } else {
                    this.bin = `node`;
                }

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
            const config = new MyConfig({ root: __dirname });
            for (const [name, info] of this.serviceContainer.cliControllers.controllers.entries()) {
                config.commandsMap[name] = buildOclifCommand(name, info.controller, this.serviceContainer.getRootInjectorContext().createChildScope('cli').getInjector(info.context.id));
            }

            await Main.run(argv, config);
        } catch (e) {
            if (e instanceof ExitError) {
                return e.oclif.exit;
            } else {
                console.log(e);
            }
            return 12;
        }
        return result;
    }
}
