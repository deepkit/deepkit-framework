import { ClassType, isArray, isFunction } from '@deepkit/core';
import { reflect, ReflectionKind } from '@deepkit/type';
import { InjectorContext, Resolver } from './injector.js';
import { ProviderWithScope } from './provider.js';
import { InjectorModule } from './module.js';

export function wrapComponent<T extends Function>(fn: T & { __injected?: any }, container: InjectorContext): any {
    if (fn.__injected) return fn.__injected;

    const type = reflect(fn);
    if (type.kind !== ReflectionKind.function) return fn;

    const args: Resolver<any>[] = [];
    const injector = container.getRootInjector();

    const componentName = fn.name;

    for (let i = 1; i < type.parameters.length; i++) {
        args.push(injector.getResolver(type.parameters[i], `${componentName}.${type.parameters[i].name}`));
    }

    const fnWithInjected = (props: any) => {
        return fn(props, ...(args.map(v => v())));
    };

    return fn.__injected = function (props: any) {
        const children = fnWithInjected(props);

        const propsChildren: any[] = [];
        let changed = false;

        // console.log('children.props.children', children);
        if ('object' === typeof children && isFunction(children.type)) {
            // NextJS server side has different children return type
            return { ...children, type: wrapComponent(children.type, container) };

        } else if ('object' === typeof children && children.props && isArray(children.props.children)) {
            //that's React in frontend
            for (const child of children.props.children) {
                if ('object' === typeof child && 'function' === typeof child.type) {
                    propsChildren.push({ ...child, type: wrapComponent(child.type, container) });
                    changed = false;
                } else {
                    propsChildren.push(child);
                }
            }

            if (changed) {
                //React freezes the object, so we have to create a new one
                return { ...children, props: { ...children.props, children: propsChildren } };
            }
        }

        return children;
    } as any;
}

export function provideServices<T extends Function>(fn: T, providers: ProviderWithScope[]): T {
    const container = InjectorContext.forProviders(providers);

    return wrapComponent(fn, container);
}

/**
 * Wraps the given component with a new injector context.
 *
 * @example
 * ```typescript
 * export class User {
 *     constructor(public name: string) {
 *     }
 * }
 *
 * const providers: ProviderWithScope[] = [
 *     { provide: User, useValue: new User('Peter') }
 * ];
 *
 * function App(props: {}, user: User) {
 *     console.log('user', user);
 * }
 *
 * ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
 *     <React.StrictMode>
 *         <ServiceContainer providers={providers}>
 *             <App/>
 *         </ServiceContainer>
 *     </React.StrictMode>,
 * );
 * ````
 *
 *
 * @param props.providers The providers to use for the new injector context.
 * @param props.module The module to use for the new injector context, instead of providers.
 * @param props.state The state class to use for the new injector context.
 */
export function ServiceContainer(props: { providers?: ProviderWithScope[], module?: InjectorModule, state?: ClassType, children?: any }): any {
    const children = props.children;
    const cacheContainer: any = props.providers || props.module;
    if (!cacheContainer) throw new Error('No providers or module given');
    if (!cacheContainer.__injected) {
        const module = props.module || new InjectorModule(props.providers || []);
        if (props.state) module.setConfigDefinition(props.state);
        const container = new InjectorContext(module);
        cacheContainer.__injected = wrapComponent(children.type, container);
    }

    return { ...props.children, type: cacheContainer.__injected };
}
