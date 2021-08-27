import { ClassType, isFunction } from '@deepkit/core';
import { FieldDecoratorWrapper } from '@deepkit/type';
import { InjectorModule } from './injector';


export class InjectorReference {
    constructor(public readonly to: any, public module?: InjectorModule) {
    }
}

export function injectorReference<T>(classTypeOrToken: T): any {
    return new InjectorReference(classTypeOrToken);
}

export interface InjectDecorator {
    (target: object, property?: string, parameterIndexOrDescriptor?: any): any;

    /**
     * Mark as optional.
     */
    readonly optional: this;

    /**
     * Resolves the dependency token from the root injector.
     */
    readonly root: this;

    readonly options: { token: any, optional: boolean, root: boolean };
}

export type InjectOptions = {
    token: any | ForwardRef<any>;
    optional: boolean;
    root: boolean;
};

type ForwardRef<T> = () => T;

const injectSymbol = Symbol('inject');

export function isInjectDecorator(v: any): v is InjectDecorator {
    return isFunction(v) && v.hasOwnProperty(injectSymbol);
}

export function inject(token?: any | ForwardRef<any>): InjectDecorator {
    const injectOptions: InjectOptions = {
        optional: false,
        root: false,
        token: token,
    };

    const fn = (target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) => {
        FieldDecoratorWrapper((target: object, property, returnType) => {
            property.data['deepkit/inject'] = injectOptions;
            property.setFromJSType(returnType);
        })(target, propertyOrMethodName, parameterIndexOrDescriptor);
    };

    Object.defineProperty(fn, injectSymbol, { value: true, enumerable: false });

    Object.defineProperty(fn, 'optional', {
        get() {
            injectOptions.optional = true;
            return fn;
        }
    });

    Object.defineProperty(fn, 'options', {
        get() {
            return injectOptions;
        }
    });

    Object.defineProperty(fn, 'root', {
        get() {
            injectOptions.optional = true;
            return fn;
        }
    });

    return fn as InjectDecorator;
}

/**
 * A injector token for tokens that have no unique class name.
 *
 * ```typescript
 *  export interface ServiceInterface {
 *      doIt(): void;
 *  }
 *  export const Service = new InjectorToken<ServiceInterface>('service');
 *
 *  {
 *      providers: [
 *          {provide: Service, useFactory() => ... },
 *      ]
 *  }
 *
 *  //user side
 *  const service = injector.get(Service);
 *  service.doIt();
 * ```
 */
export class InjectorToken<T> {
    type!: T;

    constructor(public readonly name: string) {
    }

    toString() {
        return 'InjectToken=' + this.name;
    }
}

/**
 * This decorator makes sure that meta-data is emitted by TypeScript from your constructor.
 *
 * This works in combination with the tsconfig setting "emitDecoratorMetadata".
 *
 * To have runtime type information available of constructor arguments, you have to use this
 * decorator. While technically its not required for anything else (even if you have no
 * constructor arguments at all), it is recommended to just add it to all services. This makes
 * sure you don't get surprising behaviour when you add constructor arguments at a later time.
 *
 * ```typescript
 * @injectable
 * class Service {}
 *
 * @injectable
 * class Service {
 *     constructor(private other: OtherService) {}
 * }
 * ```
 */
export function injectable(constructor: ClassType) {
    //don't do anything. This is just used to generate type metadata.
}
