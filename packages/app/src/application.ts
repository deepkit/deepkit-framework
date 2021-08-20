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
import { EnvConfiguration, resolveEnvFilePath } from './configuration';

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

function convertNameStrategy(namingStrategy: EnvNamingStrategy, name: string): string {
    const strategy = isFunction(namingStrategy) ? namingStrategy(name) || 'same' : namingStrategy;
    if (strategy === 'upper') {
        return camelToUpperCase(name);
    } else if (strategy === 'lower') {
        return camelToLowerCase(name);
    } else if (strategy === 'same') {
        return name;
    } else {
        return strategy;
    }
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
        const name = convertNameStrategy(namingStrategy, property.name);

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

/**
 * Options for configuring an instance of the EnvConfigLoader
 */
 interface EnvConfigOptions {
    /**
     * A path or paths to optional .env files that will be processed and mapped to app/module config
     */
    envFilePath?: string | string[],
    /**
     * A naming strategy for converting env variables to app/module config. Defaults to 'upper'.
     * For example, allows converting DB_HOST to dbHost
     */
    namingStrategy?: EnvNamingStrategy,
    /**
     * A prefix for environment variables that helps to avoid potential collisions
     * By default this will be set to APP_
     *
     * Eg.
     * APP_DATABASE_URL="mongodb://localhost/mydb" will be mapped to databaseUrl when using the upper
     * naming strategy
     *
     */
    prefix?: string
}

const defaultEnvConfigOptions: Required<EnvConfigOptions> = {
    prefix: 'APP_',
    envFilePath: ['.env'],
    namingStrategy: 'upper'
}

class EnvConfigLoader {
    private readonly prefix: string;
    private readonly envFilePaths: string[];
    private readonly namingStrategy: EnvNamingStrategy;

    constructor(options?: EnvConfigOptions) {
        const normalizedOptions = {
            ...defaultEnvConfigOptions,
            ...options
        };

        const { prefix, envFilePath, namingStrategy } = normalizedOptions;

        this.prefix = prefix;
        this.envFilePaths = Array.isArray(envFilePath) ? envFilePath : [envFilePath];
        this.namingStrategy = namingStrategy;
    }

    load(moduleName: string, config: { [p: string]: any }, schema: ClassSchema) {
        const envConfiguration = new EnvConfiguration();
        for (const path of this.envFilePaths) {
            if (envConfiguration.loadEnvFile(path)) break;
        }
        const env = Object.assign({}, envConfiguration.getAll());
        Object.assign(env, process.env);

        parseEnv(config, this.prefix, schema, '', convertNameStrategy(this.namingStrategy, moduleName), this.namingStrategy, env);
    }
}

export class CommandApplication<T extends ModuleOptions, C extends ServiceContainer<T> = ServiceContainer<T>> {
    protected envConfigLoader?: EnvConfigLoader;

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
     * Loads environment variables and optionally reads from .env files in order to find matching configuration options
     * in your application and modules in order to set their values.
     *
     * Prefixing ENV variables is encouraged to avoid collisions and by default a prefix of APP_ is used
     * Example:
     *
     * APP_databaseUrl="mongodb://localhost/mydb"
     *
     * Application.create({}).loadConfigFromEnvVariables('APP_').run();
     *
     *
     * `envFilePath` can be either an absolute or relative path. For relative paths the first
     * folder with a package.json starting from process.cwd() upwards is picked.
     *
     * So if you use 'local.env' make sure a 'local.env' file is located beside your 'package.json'.
     *
     * @param options Configuration options for retrieving configuration from env
     * @returns
     */
    loadConfigFromEnv(options?: EnvConfigOptions): this {
        this.addConfigLoader(new EnvConfigLoader(options));
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

                if (binPaths.length === 2) {
                    const bin = basename(binPaths[0]);
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
