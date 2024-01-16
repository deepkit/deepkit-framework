/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, getClassName } from '@deepkit/core';
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    deserialize, hasDefaultValue, isOptional,
    metaAnnotation,
    reflect,
    ReflectionClass,
    ReflectionFunction,
    ReflectionKind,
    ReflectionParameter,
    ReflectionProperty,
    stringifyType,
    Type,
    TypeAnnotation,
    TypeParameter,
    TypeProperty,
    TypePropertySignature,
    typeToObject,
    validate,
    ValidationError
} from '@deepkit/type';
import { EventDispatcher } from '@deepkit/event';
import { getInjectOptions, InjectorContext, InjectorModule } from '@deepkit/injector';
import { ControllerConfig } from './service-container.js';
import { LoggerInterface } from '@deepkit/logger';
import { onAppError, onAppExecute, onAppExecuted, onAppShutdown } from './app.js';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';

/**
 * Flag is a command line argument that is prefixed with `--` and can have a value.
 */
export type Flag<Options extends { char?: string, hidden?: boolean, description?: string } = {}> = TypeAnnotation<'cli:flag', Options>;

class CommandDecoratorDefinition {
    name: string = '';
    description: string = '';
}

class CommandDecorator {
    t = new CommandDecoratorDefinition;

    controller(name: string, options?: { description?: string }) {
        this.t.name = name;
        if (options) {
            if (options.description) this.t.description = options.description;
        }
    }

}

export const cli: ClassDecoratorResult<typeof CommandDecorator> = createClassDecoratorContext(CommandDecorator);

export interface Command {
    execute(...args: any[]): Promise<number | void> | number | void;
}

export function isCommand(classType: ClassType<Command>) {
    return !!cli._fetch(classType);
}


function convert(propertySchema: ReflectionParameter | ReflectionProperty, value: any) {
    if (value === undefined && !propertySchema.isValueRequired()) {
        return undefined;
    }
    if (propertySchema.type.kind === ReflectionKind.array && !Array.isArray(value)) {
        value = [value];
    }
    value = deserialize(value, undefined, undefined, undefined, propertySchema.type);
    const errors = validate(value, propertySchema.type);
    if (errors.length) {
        throw errors[0];
    }
    return value;
}

/**
 * Auto-detect some types as flag.
 */
function supportedAsFlag(type: Type): boolean {
    if (supportedAsArgument(type)) return false;

    return type.kind === ReflectionKind.boolean;
}

function supportedAsArgument(type: Type): boolean {
    if (type.kind === ReflectionKind.string || type.kind === ReflectionKind.number || type.kind === ReflectionKind.literal) return true;
    if (type.kind === ReflectionKind.union) return type.types.every(v => supportedAsArgument(v));
    return false;
}

declare const Deno: any;
declare const Bun: any;

export function getBinFromEnvironment(): string[] {
    if ('undefined' !== typeof process && process.argv) {
        return process.argv.slice(0, 2);
    }

    if ('undefined' !== typeof Deno && Deno.args) {
        return ['deno', 'run', Deno.main?.filename || ''];
    }

    if ('undefined' !== typeof Bun && Bun.argv) {
        return Bun.argv.slice(0, 2);
    }

    return [];
}

export function getArgsFromEnvironment(): string[] {
    if ('undefined' !== typeof process && process.argv) {
        return process.argv.slice(2);
    }

    if ('undefined' !== typeof Deno && Deno.args) {
        return Deno.args;
    }

    if ('undefined' !== typeof Bun && Bun.argv) {
        return Bun.argv.slice(2);
    }

    return [];
}

export function parseCliArgs(args: string[], aliases: { [name: string]: string } = {}): { [name: string]: boolean | string | string[] } {
    const result: { [name: string]: boolean | string | string[] } = {};
    let current: string | undefined = undefined;

    function append(name: string, value: string | boolean) {
        name = aliases[name] || name;

        const existing = result[name];

        if ('string' === typeof existing) {
            result[name] = [existing];
        }

        if (Array.isArray(result[name])) {
            (result[name] as any).push(value);
        } else {
            result[name] = value;
        }
    }

    for (const arg of args) {
        if (arg.startsWith('--')) {
            if (current) {
                append(current, true);
            }
            current = arg.substr(2);
            if (current.includes(' ')) {
                const [name, value] = current.split(' ');
                append(name, value);
                current = undefined;
            }
        } else if (arg.startsWith('-')) {
            if (current) {
                append(current, true);
            }
            current = arg.substr(1);
        } else {
            if (current) {
                append(current, arg);
            } else {
                //no current flag, so it's a positional argument
                if (!result['@']) result['@'] = [];
                (result['@'] as any).push(arg);
            }
            current = undefined;
        }
    }

    if (current) {
        result[current] = true;
    }

    return result;
}

/**
 * Returns the longest string length of all names.
 */
function getSpacing(names: string[]): number {
    return names.reduce((max, name) => Math.max(max, name.length), 0) + 1;
}

export interface ParsedCliControllerConfig {
    controller?: ClassType,
    callback?: Function;
    description?: string;
    name: string;
    module: InjectorModule;
}

/**
 * Tries to create a command name from a class name or function name.
 * //test => test
 * //testCommand => test-command
 * //TestCommand => test-command
 * //Test => test
 * //TestSomething => test-something
 * //system_crazyCommand => system:crazy-command
 * //system_crazy => system:crazy
 * //system_crazyCommandSomething => system:crazy-command-something
 * //system_subSystem_test => system:sub-system:test
 */
function commandNameFromSymbol(symbolName: string) {
    return symbolName.replace(/_+/g, ':')
        .replace(/([A-Z])/g, '-$1').replace(/^-/, '').toLowerCase()
        .replace(/-command$/, '').replace(/-controller/, '-');
}

export function parseControllerConfig(config: ControllerConfig): ParsedCliControllerConfig {
    let name = config.name || '';
    let description = '';
    if (!name && config.controller) {
        name = commandNameFromSymbol(getClassName(config.controller));
    } else if (!name && config.callback) {
        name = commandNameFromSymbol(config.callback.name);
    }

    const decoratorConfig = config.controller ? cli._fetch(config.controller) : undefined;
    if (decoratorConfig) {
        if (decoratorConfig.description) description = decoratorConfig.description;
        if (decoratorConfig.name) name = decoratorConfig.name;
    }

    if (!description) {
        const type = reflect(config.controller || config.callback);
        if (type.kind === ReflectionKind.function && type.description) description = type.description || '';
        if (type.kind === ReflectionKind.class && type.description) description = type.description || '';
    }

    return { controller: config.controller, callback: config.callback, description, name, module: config.module };
}

function printTopics(script: string, forTopic: string, commands: ParsedCliControllerConfig[], writer: CommandWriter) {
    writer('<yellow>USAGE</yellow>');
    writer(`  $ ${script} ${forTopic ? forTopic + ':' : ''}[COMMAND]`);
    writer('');
    writer('<yellow>COMMANDS</yellow>');
    const descriptionSpacing = getSpacing(commands.map(cmd => cmd.name));

    let lastTopic = '';
    for (const cmd of commands) {
        const topic = cmd.name.lastIndexOf(':') ? cmd.name.substr(0, cmd.name.lastIndexOf(':')) : '';
        if (lastTopic !== topic) {
            lastTopic = topic;
            writer(topic);
        }
        if (cmd.description) {
            const nameWithSpacing = `<green>${cmd.name}</green>` + ' '.repeat(descriptionSpacing - cmd.name.length);
            writer('  ' + nameWithSpacing + ' ' + cmd.description);
        } else {
            writer(`  <green>${cmd.name}</green>`);
        }
    }
    writer('');
    writer(`For more information on a specific command or topic, type '[command/topic] --help'`);
}

function getParamFlags(parameter: TypeParameter | TypeProperty | TypePropertySignature): string {
    const flags: string[] = [];
    if (parameter.type.kind === ReflectionKind.array) {
        flags.push('multiple');
    }
    const optional = isOptional(parameter) || hasDefaultValue(parameter);
    if (optional) flags.push('optional');
    return flags.length ? `[${flags.join(', ')}]` : '';
}

function getParamIdentifier(parameter: CommandParameter): string {
    const elementType = parameter.parameter.type.kind === ReflectionKind.array ? parameter.parameter.type.type : parameter.parameter.type;

    if (parameter.kind === 'flag' || parameter.kind === 'flag-property') {
        if (parameter.parameter.type.kind === ReflectionKind.boolean) {
            return `<green>--${parameter.name}</green>`;
        }
        return `<green>--${parameter.name} <${stringifyType(elementType)}></green>`;
    }
    return `<green>${parameter.name}</green>`;
}

function printHelp(script: string, command: ParsedCliControllerConfig, writer: CommandWriter) {
    const commandParameters = collectCommandParameter(command);
    const args = commandParameters.filter(v => v.kind === 'argument');

    writer('<yellow>USAGE</yellow>');
    writer(`  $ ${script} ${command.name} [OPTIONS] ${args.map(v => `[${v.name}]`).join(' ')}`);
    writer('');

    writer('<yellow>DESCRIPTION</yellow>');
    writer(`${command.description || ''}`);
    writer('');

    if (args.length) {
        writer('<yellow>ARGUMENTS</yellow>');
        for (const parameter of args) {
            writer(`  ${parameter.name}</green>\t${parameter.parameter.description || ''}<yellow>${getParamFlags(parameter.parameter)}</yellow>`);
        }
    }

    writer('<yellow>OPTIONS</yellow>');

    const descriptionSpacing = getSpacing(commandParameters.map(getParamIdentifier));

    for (const parameter of commandParameters) {
        if (parameter.kind === 'argument' || parameter.kind === 'service') continue;
        const label = getParamIdentifier(parameter);
        const nameWithSpacing = label + ' '.repeat(descriptionSpacing - label.length);
        writer(`  ${nameWithSpacing}${parameter.parameter.description || ''}<yellow>${getParamFlags(parameter.parameter)}</yellow>`);
    }
}

export type CommandWriter = (...message: string[]) => void;

interface ParameterMeta {
    flag: boolean;
    char: string;
    hidden: boolean;
    description: string;
}

function getParameterMeta(parameter: TypeParameter | TypeProperty | TypePropertySignature): ParameterMeta {
    const metaFlag = metaAnnotation.getForName(parameter.type, 'cli:flag');
    const flagOptions = metaFlag && metaFlag.length ? typeToObject(metaFlag[0]) : {};

    return {
        flag: !!metaFlag,
        char: flagOptions.char || '',
        hidden: flagOptions.hidden === true,
        description: flagOptions.description || '',
    };
}

/**
 * bin: the binary name, e.g. ['node', 'app.ts']
 * argv: the arguments, e.g. ['command', '--help']
 * writer: a function used to write the output. Defaults to console.log.
 */
export async function executeCommand(
    script: string,
    argv: string[],
    eventDispatcher: EventDispatcher,
    logger: LoggerInterface,
    injector: InjectorContext,
    commandsConfigs: ControllerConfig[],
    writer?: CommandWriter
): Promise<number> {
    let commands = commandsConfigs.map(v => parseControllerConfig(v));

    if (!writer) {
        writer = (...message: string[]) => logger.log(...message);
    }
    const help = argv.some(v => v === '--help') || argv[0] === 'help';

    const first = argv[0] === 'help' || argv[0] === '--help' ? '' : argv[0];
    const command = commands.find(cmd => cmd.name === first);

    if (argv.length === 0 || (argv.length === 1) || help) {
        const topicPrefix = argv.length === 1 && first ? first + ':' : '';

        if (command && help) {
            printHelp(script, command, writer);
            return 0;
        } else if (!command) {
            //print topics
            commands = commands.filter(cmd => cmd.name?.startsWith(topicPrefix));

            //sort so that the ones without topics ( no ':' ) are first, then by name
            commands.sort((a, b) => {
                if (a.name?.includes(':') && !b.name?.includes(':')) return 1;
                if (!a.name?.includes(':') && b.name?.includes(':')) return -1;
                return a.name?.localeCompare(b.name || '') || 0;
            });

            printTopics(script, topicPrefix.slice(0, -1), commands, writer);
            return 0;
        }
    }

    if (!command) {
        writer(`Command "${first}" not found.`);
        return 1;
    }
    try {
        return await runCommand(command, argv.slice(1), injector, eventDispatcher);
    } catch (e) {
        writer(`The command "${command.name}" failed.`);
        if (e instanceof Error) {
            writer(e.stack || e.message);
        } else {
            writer(String(e));
        }
        return 1;
    }
}

function handleConvertError(parameter: TypeParameter | TypeProperty | TypePropertySignature, value: any, error: any) {
    let group = parameter.kind === ReflectionKind.parameter ? 'argument' : 'property';
    let name = String(parameter.name);
    if (getParameterMeta(parameter).flag) {
        name = '--' + String(parameter.name);
        group = 'option';
    }
    if (error instanceof ValidationError) {
        throw new Error(`Invalid value for ${group} ${name}: ${value}. ${error.errors[0].message} [${error.errors[0].code}]`);
    }
    throw new Error(`Invalid value for ${group} ${name}: ${value}. ${String(error.message)}`);
}

interface CommandParameter {
    name: string;
    kind: 'argument' | 'flag' | 'flag-property' | 'service';
    reflection: ReflectionProperty | ReflectionParameter;
    parameter: TypeParameter | TypeProperty | TypePropertySignature;
}

function collectCommandParameter(config: ParsedCliControllerConfig) {
    const parameters = config.callback
        ? ReflectionFunction.from(config.callback).getParameters()
        : config.controller
            ? ReflectionClass.from(config.controller).getMethod('execute').getParameters()
            : [];

    const result: CommandParameter[] = [];

    for (const reflection of parameters) {
        const parameter = reflection.parameter;
        const meta = getParameterMeta(reflection.parameter);
        const injectToken = getInjectOptions(reflection.parameter.type);
        const isSimple = supportedAsArgument(reflection.parameter.type);

        if ((meta.flag || supportedAsFlag(reflection.parameter.type)) && !injectToken) {
            result.push({ name: reflection.name, kind: 'flag', reflection, parameter });
        } else {
            //it's either a simple string|number positional argument or a service
            if (isSimple && !injectToken) {
                result.push({ name: parameter.name, kind: 'argument', reflection, parameter });
            } else {
                result.push({ name: parameter.name, kind: 'service', reflection, parameter });
            }
        }
    }

    if (config.controller) {
        const classSchema = ReflectionClass.from(config.controller);
        for (const reflection of classSchema.getProperties()) {
            const meta = getParameterMeta(reflection.property);
            if (!meta.flag) continue;
            result.push({ name: reflection.name, kind: 'flag-property', reflection, parameter: reflection.property });
        }
    }

    return result;
}

export async function runCommand(
    config: ParsedCliControllerConfig,
    argv: string[],
    injector: InjectorContext,
    eventDispatcher: EventDispatcher,
): Promise<any> {
    const parameters = config.callback
        ? ReflectionFunction.from(config.callback).getParameters()
        : config.controller
            ? ReflectionClass.from(config.controller).getMethod('execute').getParameters()
            : [];

    const stopwatch = injector.get(Stopwatch);
    const aliases: { [name: string]: string } = {};
    const parameterValues: { [name: string]: any } = {};

    for (const parameter of parameters) {
        const meta = getParameterMeta(parameter.parameter);
        if (meta.char) {
            aliases[meta.char] = parameter.name;
        }
    }

    const parsedArgs = parseCliArgs(argv, aliases);

    const args: any[] = [];
    let positionalIndex = 0;
    const positionalArguments: any[] = Array.isArray(parsedArgs['@']) ? parsedArgs['@'] : [];
    const commandParameters = collectCommandParameter(config);

    for (const parameter of commandParameters) {
        if (parameter.kind === 'service') {
            const injectToken = getInjectOptions(parameter.parameter.type);
            try {
                args.push(injector.get(injectToken || parameter.parameter.type));
            } catch (error) {
                handleConvertError(parameter.parameter, parsedArgs[parameter.name], error);
            }
            continue;
        }
        let raw = parsedArgs[parameter.name];
        if (parameter.kind === 'argument') {
            raw = positionalArguments[positionalIndex];
            positionalIndex++;
        }

        try {
            const v = convert(parameter.reflection, raw);
            parameterValues[parameter.name] = v;
            if (parameter.kind !== 'flag-property') {
                args.push(v);
            }
        } catch (error) {
            handleConvertError(parameter.parameter, raw, error);
        }
    }

    const label = config.controller ? getClassName(config.controller) : config.callback ? config.callback.name : '';

    await eventDispatcher.dispatch(onAppExecute, { command: config.name, parameters: parameterValues, injector });
    const frame = stopwatch.active ? stopwatch.start(config.name + '(' + label + ')', FrameCategory.cli, true) : undefined;

    let exitCode: any = 1;
    try {
        //property injection possible, too
        if (config.controller) {
            const instance = injector.get(config.controller, config.module);
            for (const parameter of commandParameters) {
                if (parameter.kind !== 'flag-property') continue;
                instance[parameter.name] = parameterValues[parameter.name];
            }
            if (frame) {
                exitCode = await frame.run(() => instance.execute(...args));
            } else {
                exitCode = await instance.execute(...args);
            }
        } else if (config.callback) {
            if (frame) {
                exitCode = await frame.run(() => config.callback!(...args));
            } else {
                exitCode = await config.callback(...args);
            }
        }
        exitCode = 'number' === typeof exitCode ? exitCode : 0;
        await eventDispatcher.dispatch(onAppExecuted, { exitCode, command: config.name, parameters: parameterValues, injector });
        return exitCode;
    } catch (error) {
        await eventDispatcher.dispatch(onAppError, {
            command: config.name,
            parameters: parameterValues,
            injector,
            error: error instanceof Error ? error : new Error(String(error))
        });
        throw error;
    } finally {
        if (frame) frame.end();
        await eventDispatcher.dispatch(onAppShutdown, { command: config.name, parameters: parameterValues, injector });
    }
}
