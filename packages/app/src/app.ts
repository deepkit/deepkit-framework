/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, ExtractClassType, isFunction, isObject, pathBasename, setPathValue } from '@deepkit/core';
import { ConfigLoader, ServiceContainer } from './service-container.js';
import { ConfigureProviderOptions, injectedFunction, InjectorContext, ResolveToken, Token } from '@deepkit/injector';
import { AppModule, RootModuleDefinition } from './module.js';
import { EnvConfiguration } from './configuration.js';
import {
    DataEventToken,
    DispatchArguments,
    EventDispatcher,
    EventDispatcherDispatchType,
    EventListener,
    EventListenerCallback,
    EventToken,
} from '@deepkit/event';
import { ReceiveType, ReflectionClass, ReflectionKind } from '@deepkit/type';
import { Logger } from '@deepkit/logger';
import { executeCommand, getArgsFromEnvironment, getBinFromEnvironment } from './command.js';

export function setPartialConfig(target: { [name: string]: any }, partial: {
    [name: string]: any
}, incomingPath: string = '') {
    for (const i in partial) {
        const path = (incomingPath ? incomingPath + '.' : '') + i;
        if (isObject(partial[i])) {
            setPartialConfig(target, partial[i], path);
        } else {
            setPathValue(target, path, partial[i]);
        }
    }
}

type EnvNamingStrategy =
    'same'
    | 'upper'
    | 'lower'
    | ((name: string) => string | 'same' | 'upper' | 'lower' | undefined);

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
    envContainer: { [name: string]: any },
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
                envContainer,
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
    namingStrategy: 'upper',
};

class EnvConfigLoader {
    private readonly prefix: string;
    private readonly envFilePaths: string[];
    private readonly namingStrategy: EnvNamingStrategy;

    constructor(options?: EnvConfigOptions) {
        const normalizedOptions = {
            ...defaultEnvConfigOptions,
            ...options,
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

    public appModule: AppModule<ExtractClassType<T['config']>>;

    constructor(
        appModuleOptions: T,
        serviceContainer?: ServiceContainer,
        appModule?: AppModule<any>,
    ) {
        this.appModule = appModule || new RootAppModule({}, appModuleOptions) as any;
        this.serviceContainer = serviceContainer || new ServiceContainer(this.appModule);
    }

    static fromModule<T extends RootModuleDefinition>(module: AppModule<T>): App<T> {
        return new App({} as T, undefined, module);
    }

    /**
     * Allows to change the module after the configuration has been loaded, right before the service container is built.
     *
     * This enables you to change the module or its imports depending on the configuration the last time before their services are built.
     *
     * At this point no services can be requested as the service container was not built.
     */
    setup(...args: Parameters<this['appModule']['setup']>): this {
        this.appModule = (this.appModule.setup as any)(...args as any[]);
        return this;
    }

    /**
     * Allows to call services before the application bootstraps.
     *
     * This enables you to configure modules and request their services.
     */
    use(setup: (...args: any[]) => void): this {
        this.appModule.use(setup);
        return this;
    }

    /**
     * Calls a function immediately and resolves all parameters using the
     * current service container.
     */
    call<T>(fn: (...args: any[]) => T, module?: AppModule<any>): T {
        const injector = this.serviceContainer.getInjector(module || this.appModule);
        const resolvedFunction = injectedFunction(fn, injector);
        return resolvedFunction();
    }

    command(name: string | ((...args: any[]) => any), callback?: (...args: any[]) => any): this {
        callback = isFunction(name) ? name : callback!;
        name = isFunction(name) ? '' : name;
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

    /**
     * Register a new event listener for given token.
     *
     * order: The lower the order, the sooner the listener is called. Default is 0.
     */
    listen<T extends EventToken<any>>(eventToken: T, callback: EventListenerCallback<T>, order: number = 0): this {
        const listener: EventListener = { callback, order, eventToken };
        this.appModule.listeners.push(listener);
        return this;
    }

    dispatch<T extends EventToken<any>>(eventToken: T, ...args: DispatchArguments<T>): EventDispatcherDispatchType<T> {
        return this.get(EventDispatcher).dispatch(eventToken, ...args);
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
            },
        });
        return this;
    }

    async run(argv?: any[], bin?: string[]) {
        const exitCode = await this.execute(argv, bin);
        if (exitCode > 0) process.exit(exitCode);
    }

    get<T>(token?: ReceiveType<T> | Token<T>, moduleOrClass?: AppModule<any> | ClassType<AppModule<any>>): ResolveToken<T> {
        return this.serviceContainer.getInjector(moduleOrClass || this.appModule).get(token) as ResolveToken<T>;
    }

    public getInjectorContext(): InjectorContext {
        return this.serviceContainer.getInjectorContext();
    }

    /**
     * @see InjectorModule.configureProvider
     */
    configureProvider<T>(configure: (instance: T, ...args: any[]) => any, options: Partial<ConfigureProviderOptions> = {}, type?: ReceiveType<T>): this {
        this.appModule.configureProvider<T>(configure, options, type);
        return this;
    }

    public async execute(argv?: string[], bin?: string[] | string): Promise<number> {
        const eventDispatcher = this.get(EventDispatcher);
        const logger = this.get(Logger);

        if ('undefined' !== typeof process) {
            process.on('unhandledRejection', error => {
                // Will print "unhandledRejection err is not defined"
                logger.error('unhandledRejection', error);
            });
        }

        const scopedInjectorContext = this.getInjectorContext().createChildScope('cli');

        if ('string' !== typeof bin) {
            bin = bin || getBinFromEnvironment();
            let binary = pathBasename(bin[0]);
            let file = pathBasename(bin[1]);
            bin = `${binary} ${file}`;
        }

        return await executeCommand(
            bin, argv || getArgsFromEnvironment(),
            eventDispatcher, logger,
            scopedInjectorContext,
            this.serviceContainer.cliControllerRegistry.controllers,
        );
    }
}
