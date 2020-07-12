import {FieldDecoratorWrapper, getClassSchema} from "@super-hornet/marshal";
import {ClassProvider, ExistingProvider, FactoryProvider, Provider, ValueProvider,} from './provider';
import {ClassType, getClassName, isClass, isFunction} from "@super-hornet/core";

export interface InjectDecorator {
    (target: object, property?: string, parameterIndexOrDescriptor?: any): any;

    /**
     * Mark as optional.
     */
    optional(): this;
}

type InjectOptions = {
    token: any | ForwardRef<any>;
    optional: boolean;
};

type ForwardRef<T> = () => T;

export function inject(type?: any | ForwardRef<any>): InjectDecorator {
    const injectOptions: InjectOptions = {
        optional: false,
        token: type,
    }

    const fn = (target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) => {
        FieldDecoratorWrapper((target: object, property) => {
            property.data['super-hornet/inject'] = injectOptions;
        })(target, propertyOrMethodName, parameterIndexOrDescriptor);
    };

    fn.optional = () => {
        injectOptions.optional = true;
        return fn;
    };

    return fn;
}

export class InjectToken {
    constructor(public readonly name: string) {
    }

    toString() {
        return 'InjectToken=' + this.name;
    }
}

export function injectable() {
    return (target: object) => {
        //don't do anything. This is just used to generate type metadata.
    };
}

export function isValueProvider(obj: any): obj is ValueProvider {
    return obj.provide && obj.useValue;
}

export function isClassProvider(obj: any): obj is ClassProvider {
    return obj.provide && obj.useClass;
}

export function isExistingProvider(obj: any): obj is ExistingProvider {
    return obj.provide && obj.useExisting;
}

export function isFactoryProvider(obj: any): obj is FactoryProvider {
    return obj.provide && obj.useFactory;
}

const CircularDetector = new Set();

export class CircularDependencyError extends Error {
}

export class TokenNotFoundError extends Error {
}

export class DependenciesUnmetError extends Error {
}

export function tokenLabel(token: any): string {
    if (token === null) return 'null';
    if (token === undefined) return 'undefined';
    if (isClass(token)) return getClassName(token);
    if (isFunction(token.toString)) return token.toString();

    return token + '';
}

export class Injector {
    protected fetcher = new Map<any, () => any>();
    protected resolved = new Map<any, any>();

    constructor(
        protected providers: Provider[] = [],
        protected parents: Injector[] = [],
        protected heads: Injector[] = [],
    ) {
        for (const provider of providers) this.addProvider(provider);
    }

    public addProvider(provider: Provider) {
        if (isValueProvider(provider)) {
            this.fetcher.set(provider.provide, () => {
                return provider.useValue;
            });
        } else if (isClassProvider(provider)) {
            this.fetcher.set(provider.provide, () => {
                return this.create(provider.useClass);
            });
        } else if (isExistingProvider(provider)) {
            this.fetcher.set(provider.provide, () => {
                return this.fetcher.get(provider.useExisting)!();
            });
        } else if (isFactoryProvider(provider)) {
            this.fetcher.set(provider.provide, () => {
                const deps: any[] = (provider.deps || []).map(v => this.get(v));
                return provider.useFactory(...deps);
            });
        } else if (isClass(provider)) {
            this.fetcher.set(provider, () => {
                return this.create(provider);
            });
        }
    }

    public isDefined(token: any) {
        return this.fetcher.has(token);
    }

    protected create<T>(classType: ClassType<T>): T {
        const args: any[] = [];
        const argsCheck: string[] = [];
        const schema = getClassSchema(classType);

        for (const property of schema.getMethodProperties('constructor')) {
            const options = property.data['super-hornet/inject'] as InjectOptions | undefined;
            let token: any = property.resolveClassType;
            const isOptional = options && options.optional;

            if (options && options.token) {
                token = isFunction(options.token) ? options.token() : options.token;
            }

            try {
                const value = this.get(token);
                args.push(value);
                argsCheck.push('✓');
            } catch (e) {
                if (e instanceof TokenNotFoundError) {
                    if (isOptional) {
                        argsCheck.push('✓');
                        args.push(undefined);
                    } else {
                        argsCheck.push('?');
                        throw new DependenciesUnmetError(
                            `Unknown constructor argument no ${argsCheck.length} of ${getClassName(classType)}(${argsCheck.join(', ')}). ` +
                            `Make sure '${tokenLabel(token)}' is provided.`
                        )
                    }
                } else {
                    throw e;
                }
            }
        }

        return new classType(...args);
    }

    public get<T, R = T extends ClassType<infer R> ? R : T>(token: T, circularCheck: boolean = true): R {
        const root = CircularDetector.size === 0;

        if (circularCheck) {
            if (CircularDetector.has(token)) {
                const path = [...CircularDetector.values(), token].map(tokenLabel).join(' -> ');
                throw new CircularDependencyError(`Circular dependency found ${path}`);
            }

            CircularDetector.add(token);
        }

        try {
            //check first heads before we check our self or parents
            for (const head of this.heads) {
                if (head.isDefined(token)) return head.get(token, false);
            }

            let resolved = this.resolved.get(token);
            if (resolved !== undefined) return resolved;

            const builder = this.fetcher.get(token);
            if (builder) {
                resolved = builder();
                this.resolved.set(token, resolved);
                return resolved;
            }

            //check first parents before we simply create the class instance
            for (const parent of this.parents) {
                if (parent.isDefined(token)) return parent.get(token, false);
            }

            throw new TokenNotFoundError(`Could not resolve injector token ${tokenLabel(token)}`);
        } finally {
            if (root) CircularDetector.clear();
        }
    }
}
