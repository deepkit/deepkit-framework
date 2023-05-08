/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, ExtractClassType, getCurrentFileName, isFunction, isObject, setPathValue } from '@deepkit/core';
import { ConfigLoader, ServiceContainer } from './service-container.js';
import { InjectorContext, ResolveToken, Token } from '@deepkit/injector';
import { AppModule, RootModuleDefinition } from './module.js';
import { Command, Config, Options } from '@oclif/config';
import { basename, dirname, relative } from 'path';
import { Main } from '@oclif/command';
import { ExitError } from '@oclif/errors';
import { buildOclifCommand } from './oclif.js';
import { EnvConfiguration } from './configuration.js';
import { DataEventToken, EventDispatcher, EventListener, EventListenerCallback, EventOfEventToken, EventToken } from '@deepkit/event';
import { ReceiveType, ReflectionClass, ReflectionKind } from '@deepkit/type';

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
    schema: ReflectionClass<any>,
    incomingDotPath: string,
    incomingEnvPath: string,
    namingStrategy: EnvNamingStrategy,
    envContainer: { [name: string]: any }
) {
    for (const property of schema.getProperties()) {
        const name = convertNameStrategy(namingStrategy, property.name);

        if (property.type.kind === ReflectionKind.class || property.type.kind === ReflectionKind.objectLiteral) {
            parseEnv(
                config,
                prefix,
                ReflectionClass.from(property.type),
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
};

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

    load(module: AppModule<any>, config: { [p: string]: any }, schema: ReflectionClass<any>) {
        const envConfiguration = new EnvConfiguration();
        for (const path of this.envFilePaths) {
            if (envConfiguration.loadEnvFile(path)) break;
        }
        const env = Object.assign({}, envConfiguration.getAll());
        Object.assign(env, process.env);

        parseEnv(config, this.prefix, schema, '', convertNameStrategy(this.namingStrategy, module.name), this.namingStrategy, env);
    }
}

export class RootAppModule<T extends RootModuleDefinition> extends AppModule<T> {
}

export interface AppEvent {
    /**
     * The command that is about to be executed.
     */
    command: string;

    parameters: { [name: string]: any };

    /**
     * Scoped 'cli' injector context.
     */
    injector: InjectorContext;
}

export interface AppExecutedEvent extends AppEvent {
    exitCode: number;
}


export interface AppErrorEvent extends AppEvent {
    error: Error;
}

/**
 * When a CLI command is about to be executed, this event is emitted.
 *
 * This is different to @deepkit/framework's onBootstrap event, which is only executed
 * when the server:start is execute. This event is executed for every CLI command (including server:start).
 */
export const onAppExecute = new DataEventToken<AppEvent>('app.execute');

/**
 * When a CLI command is successfully executed, this event is emitted.
 */
export const onAppExecuted = new DataEventToken<AppExecutedEvent>('app.executed');

/**
 * When a CLI command failed to execute, this event is emitted.
 */
export const onAppError = new DataEventToken<AppErrorEvent>('app.error');

/**
 * When the application is about to shut down, this event is emitted.
 * This is always executed, even when an error occurred. So it's a good place to clean up.
 */
export const onAppShutdown = new DataEventToken<AppEvent>('app.shutdown');

/**
 * This is the smallest available application abstraction in Deepkit.
 *
 * It is based on a module and executes registered CLI controllers in `execute`.
 *
 * @deepkit/framework extends that with a more powerful Application class, that contains also HTTP and RPC controllers.
 *
 * You can use this class for more integrated unit-tests.
 */
export class App<T extends RootModuleDefinition> {
    protected envConfigLoader?: EnvConfigLoader;

    public readonly serviceContainer: ServiceContainer;

    public appModule: AppModule<T>;

    constructor(
        appModuleOptions: T,
        serviceContainer?: ServiceContainer,
        appModule?: AppModule<any>
    ) {
        this.appModule = appModule || new RootAppModule(appModuleOptions) as any;
        this.serviceContainer = serviceContainer || new ServiceContainer(this.appModule);
    }

    static fromModule<T extends RootModuleDefinition>(module: AppModule<T>): App<T> {
        return new App({} as T, undefined, module);
    }

    /**
     * Allows to change the module after the configuration has been loaded, right before the application bootstraps.
     */
    setup(...args: Parameters<this['appModule']['setup']>): this {
        this.serviceContainer.appModule = (this.serviceContainer.appModule.setup as any)(...args as any[]);
        return this;
    }

    command(name: string, callback: (...args: any[]) => any): this {
        this.appModule.addCommand(name, callback);
        return this;
    }

    addConfigLoader(loader: ConfigLoader): this {
        this.serviceContainer.addConfigLoader(loader);
        return this;
    }

    configure(config: Partial<ExtractClassType<T['config']>>): this {
        this.serviceContainer.appModule.configure(config);
        return this;
    }

    listen<T extends EventToken<any>, DEPS extends any[]>(eventToken: T, callback: EventListenerCallback<T['event']>, order: number = 0): this {
        const listener: EventListener<any> = { callback, order, eventToken };
        this.appModule.listeners.push(listener);
        return this;
    }

    public async dispatch<T extends EventToken<any>>(eventToken: T, event: EventOfEventToken<T>, injector?: InjectorContext): Promise<void> {
        return await this.get(EventDispatcher).dispatch(eventToken, event, injector);
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
     * new App({}).loadConfigFromEnvVariables('APP_').run();
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
     * new App().run().loadConfigFromEnvVariable('APP_CONFIG').run();
     */
    loadConfigFromEnvVariable(variableName: string = 'APP_CONFIG'): this {
        if (!process.env[variableName]) return this;

        this.addConfigLoader({
            load(module: AppModule<any>, config: { [p: string]: any }, schema: ReflectionClass<any>) {
                try {
                    const jsonConfig = JSON.parse(process.env[variableName] || '');

                    setPartialConfig(config, module.name ? jsonConfig[module.name] : jsonConfig);
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

    get<T>(token?: ReceiveType<T> | Token<T>, moduleOrClass?: AppModule<any> | ClassType<AppModule<any>>): ResolveToken<T> {
        return this.serviceContainer.getInjector(moduleOrClass || this.appModule).get(token) as ResolveToken<T>;
    }

    public getInjectorContext(): InjectorContext {
        return this.serviceContainer.getInjectorContext();
    }

    public async execute(argv: string[], binPaths: string[] = []): Promise<number> {
        let result: any;

        const eventDispatcher = this.get(EventDispatcher);

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
            const config = new MyConfig({ root: dirname(getCurrentFileName()) });
            const scopedInjectorContext = this.getInjectorContext().createChildScope('cli');

            for (const [name, info] of this.serviceContainer.cliControllerRegistry.controllers.entries()) {
                config.commandsMap[name] = buildOclifCommand(name, eventDispatcher, scopedInjectorContext, info);
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
