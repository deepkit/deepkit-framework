import { ClassType, getClassName } from '@deepkit/core';
import { deserialize, ReflectionClass, ReflectionKind, ReflectionParameter, ReflectionProperty, validate, ValidationError } from '@deepkit/type';
import { Command as OclifCommandBase } from '@oclif/command';
import { Command as OclifCommand } from '@oclif/config';
import { args, flags } from '@oclif/parser';
import { IBooleanFlag, IOptionFlag } from '@oclif/parser/lib/flags';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import { cli, Command } from './command';

function getProperty(classType: ClassType, ref: {property: string; parameterIndex?: number;}): ReflectionProperty | ReflectionParameter {
    return ref.parameterIndex !== undefined
        ? ReflectionClass.from(classType).getMethodParameters(ref.property)[ref.parameterIndex]
        : ReflectionClass.from(classType).getProperty(ref.property);
}

export function buildOclifCommand(name: string, injector: InjectorContext, classType: ClassType<Command>, module: InjectorModule<any>): OclifCommand.Plugin {
    const oclifArgs: args.Input = [];
    const oclifFlags: { [name: string]: IBooleanFlag<any> | IOptionFlag<any> } = {};
    const argDefinitions = cli._fetch(classType);
    if (!argDefinitions) throw new Error(`No command name set. use @cli.controller('name')`);
    if (!argDefinitions.name) throw new Error(`No command name set. use @cli.controller('name')`);

    let converters = new Map<ReflectionProperty | ReflectionParameter, (v: any) => any>();

    for (const property of argDefinitions.args) {
        const propertySchema = getProperty(classType, property);
        converters.set(propertySchema, (value: any) => {
            if (value === undefined && !propertySchema.isValueRequired()) {
                return undefined;
            }
            value = deserialize(value, undefined, undefined, undefined, propertySchema.type);
            const errors = validate(value, propertySchema.type);
            if (errors.length) {
                throw errors[0];
            }
            return value;
        });
    }

    for (const i in argDefinitions.args) {
        if (!argDefinitions.args.hasOwnProperty(i)) continue;
        const t = argDefinitions.args[i];
        const propertySchema = getProperty(classType, t);

        const options = {
            name: propertySchema.name,
            description: t.description,
            hidden: t.hidden,
            required: !(propertySchema.isOptional() || propertySchema.hasDefault()),
            multiple: propertySchema.getType().kind === ReflectionKind.array,
            default: propertySchema.getDefaultValue(),
        };

        //todo, add `parse(i)` and make sure type is correct depending on t.propertySchema.type
        if (t.isFlag) {
            oclifFlags[propertySchema.name] = propertySchema.type.kind === ReflectionKind.boolean ? flags.boolean(options) : flags.string(options);
            if (t.char) {
                oclifFlags[propertySchema.name].char = t.char as any;
            }
        } else {
            oclifArgs.push(options);
        }
    }

    return {
        aliases: [], description: argDefinitions.description, args: oclifArgs, flags: oclifFlags, hidden: false, id: argDefinitions.name,
        load(): OclifCommand.Class {
            class Clazz extends OclifCommandBase {
                static args = oclifArgs;
                static flags = oclifFlags;

                async run() {
                    let stopwatch: Stopwatch | undefined;
                    try {
                        stopwatch = injector.get(Stopwatch);
                    } catch {
                    }

                    const { flags, args } = this.parse(Clazz);
                    const instance = injector.get(classType, module);
                    const methodArgs: any[] = [];

                    for (const property of argDefinitions!.args) {
                        const propertySchema = getProperty(classType, property);

                        try {
                            const v = converters.get(propertySchema)!(args[propertySchema.name] ?? flags[propertySchema.name]);
                            if (propertySchema instanceof ReflectionParameter) {
                                methodArgs.push(v);
                            } else if (propertySchema instanceof ReflectionProperty) {
                                if (v !== undefined) {
                                    instance[propertySchema.name as keyof typeof instance] = v;
                                }
                            }
                        } catch (e) {
                            if (e instanceof ValidationError) {
                                for (const item of e.errors) {
                                    console.error(`Validation error in ${propertySchema.name + (item.path ? '.' + item.path : '')}: ${item.message} [${item.code}]`);
                                }
                                return 8;
                            }
                            console.error(e);
                            return 8;
                        }
                    }

                    let exitCode: any;

                    if (stopwatch) {
                        const frame = stopwatch.start(name + '(' + getClassName(classType) + ')', FrameCategory.cli, true);
                        try {
                            exitCode = await frame.run({}, () => instance.execute(...methodArgs));
                        } finally {
                            frame.end();
                        }
                    } else {
                        exitCode = await instance.execute(...methodArgs);
                    }
                    if (typeof exitCode === 'number') return exitCode;
                    return 0;
                }
            }

            return Clazz;
        }
    };
}
